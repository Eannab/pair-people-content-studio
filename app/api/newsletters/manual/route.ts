import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import { v4 as uuidv4 } from "uuid";
import { detectBDSignals } from "@/lib/bd-signal-detection";
import type { ScoredArticle } from "@/app/api/newsletters/scan/route";
import type { BDLead, MarketInsightSignal } from "@/app/api/bd/signals/route";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_CONTENT_LENGTH = 40_000;
const CHUNK_SIZE = 4_000;
const CHUNK_OVERLAP = 150;

/**
 * Split text into ~CHUNK_SIZE chunks, breaking only at paragraph boundaries
 * and carrying CHUNK_OVERLAP chars of the previous chunk into the next so
 * companies mentioned across a break aren't missed.
 */
function chunkContent(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const candidate = current ? current + "\n\n" + para : para;
    if (candidate.length > CHUNK_SIZE && current) {
      chunks.push(current);
      // carry overlap from the tail of the previous chunk
      const tail = current.slice(-CHUNK_OVERLAP);
      current = tail ? tail + "\n\n" + para : para;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text.slice(0, CHUNK_SIZE)];
}

async function extractFromChunk(
  chunk: string,
  source: string
): Promise<{ title: string; summary: string }[]> {
  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `Extract individual articles or stories from this content. A page may contain one article or multiple.

Source: ${source}

Content:
${chunk}

Return a JSON array. Each item: {"title": "headline", "summary": "2-3 sentence plain-text summary"}
If it's a single article, return it as one item.
Return ONLY the JSON array — no markdown fences, no preamble.`,
      },
    ],
  });

  const raw = res.content[0].type === "text" ? res.content[0].text.trim() : "[]";
  const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  try {
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, url, title: inputTitle } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "No content provided" }, { status: 400 });
    }

    const fullContent = content.trim().substring(0, MAX_CONTENT_LENGTH);
    const source = inputTitle?.trim() || url?.trim() || "Manual submission";
    const now = new Date().toISOString();

    // ── Step 1: Extract article(s) — chunked parallel extraction ────────────

    const chunks = chunkContent(fullContent);
    const chunkResults = await Promise.allSettled(
      chunks.map((chunk) => extractFromChunk(chunk, source))
    );

    // Merge and deduplicate by title (case-insensitive)
    const seen = new Set<string>();
    const extracted: { title: string; summary: string }[] = [];
    for (const result of chunkResults) {
      if (result.status !== "fulfilled") continue;
      for (const item of result.value) {
        const key = item.title?.toLowerCase().trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          extracted.push(item);
        }
      }
    }

    // Fallback: treat the whole paste as a single article
    if (extracted.length === 0) {
      extracted.push({
        title: inputTitle?.trim() || source,
        summary: fullContent.substring(0, 400),
      });
    }

    // ── Step 2: Score for sectors ────────────────────────────────────────────

    const listText = extracted
      .map((a, i) => `${i + 1}. "${a.title}"\n   ${a.summary}`)
      .join("\n\n");

    const scoreRes = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Score these articles 1-10 for relevance to Pair People, a Sydney tech recruitment agency.
Sectors: "defence" (Defence/DeepTech), "ai" (AI/ML), "healthtech" (Healthtech), "sydney" (Sydney Market), "general".

Articles:
${listText}

Return a JSON array (same order):
[{"topScore": 8, "topSector": "ai", "scores": {"defence": 2, "ai": 8, "healthtech": 1, "sydney": 5}, "relevanceSummary": "one sentence"}]
Return ONLY the JSON array.`,
        },
      ],
    });

    const scoreRaw =
      scoreRes.content[0].type === "text" ? scoreRes.content[0].text.trim() : "[]";
    const scoreClean = scoreRaw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let scored: Array<{
      topScore: number;
      topSector: string;
      scores: { defence: number; ai: number; healthtech: number; sydney: number };
      relevanceSummary: string;
    }> = [];
    try {
      scored = JSON.parse(scoreClean);
    } catch {
      scored = [];
    }

    const newArticles: ScoredArticle[] = extracted.map((a, i) => ({
      id: uuidv4(),
      title: a.title,
      summary: a.summary,
      source,
      receivedDate: now,
      webLink: url?.trim() || "",
      topScore: scored[i]?.topScore ?? 5,
      topSector: (scored[i]?.topSector as ScoredArticle["topSector"]) ?? "general",
      scores: scored[i]?.scores ?? { defence: 5, ai: 5, healthtech: 5, sydney: 5 },
      relevanceSummary: scored[i]?.relevanceSummary ?? "",
    }));

    // ── Step 3: Merge articles into newsletter cache ─────────────────────────

    let existingArticles: ScoredArticle[] = [];
    try {
      existingArticles = (await kv.get<ScoredArticle[]>("newsletters:articles")) ?? [];
    } catch {}

    const existingTitles = new Set(existingArticles.map((a) => a.title.toLowerCase()));
    const articlesToAdd = newArticles.filter(
      (a) => !existingTitles.has(a.title.toLowerCase())
    );

    if (articlesToAdd.length > 0) {
      const merged = [...articlesToAdd, ...existingArticles].sort(
        (a, b) => b.topScore - a.topScore
      );
      try {
        await kv.set("newsletters:articles", merged, { ex: 60 * 60 * 24 * 30 });
      } catch {}
    }

    // ── Steps 4-6: Research-first signal detection, then merge into KV ─────────

    const relevantNew = newArticles.filter((a) => a.topScore >= 4);
    if (relevantNew.length === 0) {
      return NextResponse.json({
        articlesAdded: articlesToAdd.length,
        leadsAdded: 0,
        insightsAdded: 0,
        articles: articlesToAdd,
        leads: [],
        marketInsights: [],
      });
    }

    const { bdLeads: detectedLeads, marketInsights: detectedInsights } =
      await detectBDSignals(relevantNew);

    // Merge BD leads (skip duplicates already in KV)
    let existingLeads: BDLead[] = [];
    try {
      existingLeads = (await kv.get<BDLead[]>("bd:leads")) ?? [];
    } catch {}

    const existingLeadNames = new Set(existingLeads.map((l) => l.companyName.toLowerCase()));
    const newLeads = detectedLeads.filter(
      (l) => !existingLeadNames.has(l.companyName.toLowerCase())
    );

    if (newLeads.length > 0) {
      try {
        await kv.set("bd:leads", [...existingLeads, ...newLeads], {
          ex: 60 * 60 * 24 * 30,
        });
      } catch {}

      try {
        const existingPipeline =
          (await kv.get<Array<{ id: string; companyName: string }>>("bd:pipeline")) ?? [];
        const pipelineNames = new Set(
          existingPipeline.map((p) => p.companyName.toLowerCase())
        );
        const newPipelineEntries = newLeads
          .filter((l) => !pipelineNames.has(l.companyName.toLowerCase()))
          .map((l) => ({
            id: uuidv4(),
            companyId: l.id,
            companyName: l.companyName,
            sector: l.sector,
            signals: l.signals,
            relevanceScore: l.relevanceScore,
            dateAdded: now,
            status: "new" as const,
            notes: "",
            updatedAt: now,
          }));
        if (newPipelineEntries.length > 0) {
          await kv.set("bd:pipeline", [...existingPipeline, ...newPipelineEntries]);
        }
      } catch {}
    }

    // Merge market insights (skip duplicates)
    let existingInsights: MarketInsightSignal[] = [];
    try {
      existingInsights = (await kv.get<MarketInsightSignal[]>("bd:market_insights")) ?? [];
    } catch {}

    const existingInsightNames = new Set(
      existingInsights.map((i) => i.companyName.toLowerCase())
    );
    const newInsights = detectedInsights.filter(
      (i) => !existingInsightNames.has(i.companyName.toLowerCase())
    );

    if (newInsights.length > 0) {
      try {
        await kv.set(
          "bd:market_insights",
          [...existingInsights, ...newInsights],
          { ex: 60 * 60 * 24 * 30 }
        );
      } catch {}
    }

    return NextResponse.json({
      articlesAdded: articlesToAdd.length,
      leadsAdded: newLeads.length,
      insightsAdded: newInsights.length,
      articles: articlesToAdd,
      leads: newLeads,
      marketInsights: newInsights,
    });
  } catch (err) {
    console.error("newsletters/manual error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Processing failed" },
      { status: 500 }
    );
  }
}
