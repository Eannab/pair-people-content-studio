import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import { v4 as uuidv4 } from "uuid";
import type { ScoredArticle } from "@/app/api/newsletters/scan/route";
import type { BDLead, MarketInsightSignal, CompanySignal, AustraliaPresence } from "@/app/api/bd/signals/route";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, url, title: inputTitle } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "No content provided" }, { status: 400 });
    }

    const truncated = content.trim().substring(0, 6000);
    const source = inputTitle?.trim() || url?.trim() || "Manual submission";
    const now = new Date().toISOString();

    // ── Step 1: Extract article(s) ──────────────────────────────────────────

    const extractRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Extract individual articles or stories from this content. A page may contain one article or multiple.

Source: ${source}

Content:
${truncated}

Return a JSON array. Each item: {"title": "headline", "summary": "2-3 sentence plain-text summary"}
If it's a single article, return it as one item.
Return ONLY the JSON array — no markdown fences, no preamble.`,
        },
      ],
    });

    const extractRaw =
      extractRes.content[0].type === "text" ? extractRes.content[0].text.trim() : "[]";
    const extractClean = extractRaw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let extracted: { title: string; summary: string }[] = [];
    try {
      extracted = JSON.parse(extractClean);
    } catch {
      extracted = [];
    }

    // Fallback: treat the whole paste as a single article
    if (!Array.isArray(extracted) || extracted.length === 0) {
      extracted = [
        {
          title: inputTitle?.trim() || source,
          summary: truncated.substring(0, 400),
        },
      ];
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

    // ── Step 4: Signal detection on new articles ─────────────────────────────

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

    const articleText = relevantNew
      .map(
        (a, i) =>
          `${i + 1}. [${a.topSector.toUpperCase()}] "${a.title}" (${source})\n   ${a.summary}`
      )
      .join("\n\n");

    const signalRes = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: `You are a BD analyst for Pair People, a Sydney tech recruitment agency.

Analyse these articles for recruitment buying signals (funding announcements, active hiring, product launches that precede engineering hiring).

Articles:
${articleText}

Classify each company as:
- bdLead: AU-based or actively hiring in AU, AND under 200 employees
- marketInsight: notable news but large/global, or no AU connection

Return JSON:
{
  "bdLeads": [{
    "companyName": "...",
    "sector": "ai",
    "signals": [{"type": "funded", "label": "Series A", "context": "...", "articleTitle": "...", "articleSource": "${source}"}],
    "australiaPresence": {"basedInAustralia": true, "hiringInAustralia": true, "detail": "Sydney HQ"},
    "initialRelevanceScore": 8
  }],
  "marketInsights": [{
    "companyName": "...",
    "sector": "ai",
    "signals": [{"type": "launch", "label": "...", "context": "...", "articleTitle": "...", "articleSource": "${source}"}],
    "whyExcluded": "Global company, 5000+ employees"
  }]
}

If no signals found, return {"bdLeads": [], "marketInsights": []}.
Return ONLY the JSON object — no markdown fences, no preamble.`,
        },
      ],
    });

    const signalRaw =
      signalRes.content[0].type === "text" ? signalRes.content[0].text.trim() : "{}";
    const signalClean = signalRaw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let signalData: {
      bdLeads: Array<{
        companyName: string;
        sector: string;
        signals: CompanySignal[];
        australiaPresence: AustraliaPresence;
        initialRelevanceScore: number;
      }>;
      marketInsights: Array<{
        companyName: string;
        sector: string;
        signals: CompanySignal[];
        whyExcluded: string;
      }>;
    } = { bdLeads: [], marketInsights: [] };

    try {
      signalData = JSON.parse(signalClean);
    } catch {}

    // ── Step 5: Merge BD leads ───────────────────────────────────────────────

    let existingLeads: BDLead[] = [];
    try {
      existingLeads = (await kv.get<BDLead[]>("bd:leads")) ?? [];
    } catch {}

    const existingLeadNames = new Set(
      existingLeads.map((l) => l.companyName.toLowerCase())
    );
    const newLeads: BDLead[] = (signalData.bdLeads ?? [])
      .filter((d) => !existingLeadNames.has(d.companyName.toLowerCase()))
      .map((d) => ({
        id: uuidv4(),
        companyName: d.companyName ?? "Unknown Company",
        sector: (d.sector as BDLead["sector"]) ?? "general",
        signals: d.signals ?? [],
        australiaPresence: d.australiaPresence ?? {
          basedInAustralia: false,
          hiringInAustralia: false,
          detail: "Location unclear",
        },
        overview: "",
        techStack: [],
        recentActivity: "",
        relevanceScore: d.initialRelevanceScore ?? 5,
        relevanceReason: "",
        hiringContact: { name: "", title: "", linkedInUrl: "" },
        confidence: "medium" as const,
        createdAt: now,
      }));

    if (newLeads.length > 0) {
      try {
        await kv.set("bd:leads", [...existingLeads, ...newLeads], {
          ex: 60 * 60 * 24 * 30,
        });
      } catch {}

      // Add new leads to pipeline
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

    // ── Step 6: Merge market insights ────────────────────────────────────────

    let existingInsights: MarketInsightSignal[] = [];
    try {
      existingInsights =
        (await kv.get<MarketInsightSignal[]>("bd:market_insights")) ?? [];
    } catch {}

    const existingInsightNames = new Set(
      existingInsights.map((i) => i.companyName.toLowerCase())
    );
    const newInsights: MarketInsightSignal[] = (signalData.marketInsights ?? [])
      .filter((d) => !existingInsightNames.has(d.companyName.toLowerCase()))
      .map((d) => {
        const topSignal = d.signals?.[0];
        const postContext = [
          `${d.companyName} — ${topSignal ? `${topSignal.label}: ${topSignal.context}` : "notable news"}`,
          d.signals
            .slice(1)
            .map((s) => `${s.label}: ${s.context}`)
            .join("\n"),
          `Source: ${source}`,
        ]
          .filter(Boolean)
          .join("\n\n");

        return {
          id: uuidv4(),
          companyName: d.companyName ?? "Unknown Company",
          sector: (d.sector as MarketInsightSignal["sector"]) ?? "general",
          signals: d.signals ?? [],
          whyExcluded: d.whyExcluded ?? "Does not meet BD criteria",
          postContext,
          createdAt: now,
        };
      });

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
