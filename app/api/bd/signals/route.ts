import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import { v4 as uuidv4 } from "uuid";
import type { ScoredArticle } from "@/app/api/newsletters/scan/route";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface CompanySignal {
  type: "funded" | "hiring" | "launch";
  label: string;
  context: string;
  articleTitle: string;
  articleSource: string;
}

export interface BDLead {
  id: string;
  companyName: string;
  sector: "defence" | "ai" | "healthtech" | "sydney" | "general";
  signals: CompanySignal[];
  overview: string;
  techStack: string[];
  recentActivity: string;
  relevanceScore: number;
  relevanceReason: string;
  hiringContact: {
    name: string;
    title: string;
    linkedInUrl: string;
  };
  confidence: "high" | "medium" | "low";
  researchedAt?: string;
  outreachDraft?: string;
  outreachDraftedAt?: string;
  createdAt: string;
}

export async function POST() {
  try {
    const articles = await kv.get<ScoredArticle[]>("newsletters:articles");

    if (!articles || articles.length === 0) {
      return NextResponse.json(
        { error: "No articles found. Run a newsletter scan first." },
        { status: 400 }
      );
    }

    const relevant = articles.filter((a) => a.topScore >= 5);

    if (relevant.length === 0) {
      return NextResponse.json({ leads: [], detected: 0 });
    }

    const articleText = relevant
      .map(
        (a, i) =>
          `${i + 1}. [${a.topSector.toUpperCase()}] "${a.title}" (${a.source})\n   ${a.summary}`
      )
      .join("\n\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: `You are a BD intelligence analyst for Pair People, a Sydney-based tech recruitment agency that places engineers, CTOs, and tech leaders in Defence/DeepTech, AI/ML, Healthtech, and Sydney startups.

Analyse these newsletter articles and identify companies showing buying signals for tech recruitment:
- Funding announcements (Seed, Series A/B/C, grants) — companies that just raised often need to hire quickly
- Active hiring (job posts, team expansions, hiring sprees)
- Product launches (new product, major release, pivot) — growth often precedes an engineering hiring push

Articles:
${articleText}

For each company with a concrete, specific signal, return a JSON array:
[{
  "companyName": "Acme AI",
  "sector": "ai",
  "signals": [
    {
      "type": "funded",
      "label": "Series A",
      "context": "exact quote or close paraphrase from the article showing this signal",
      "articleTitle": "title of the article it came from",
      "articleSource": "newsletter name"
    }
  ],
  "initialRelevanceScore": 7
}]

Rules:
- Only include companies with concrete signals — not vague mentions
- sector must be one of: "defence", "ai", "healthtech", "sydney", "general"
- type must be: "funded", "hiring", or "launch"
- label examples: "Series A", "Seed Round", "CTO hire", "Head of Eng role", "Product launch", "v2.0 release"
- One company can have multiple signals across multiple articles
- initialRelevanceScore 1-10: how valuable is this lead for Pair People right now?
- Return ONLY the JSON array — no markdown fences, no preamble.`,
        },
      ],
    });

    const raw =
      response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
    const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let detected: Array<{
      companyName: string;
      sector: string;
      signals: CompanySignal[];
      initialRelevanceScore: number;
    }> = [];

    try {
      detected = JSON.parse(clean);
    } catch {
      return NextResponse.json({ leads: [], detected: 0 });
    }

    if (!Array.isArray(detected) || detected.length === 0) {
      return NextResponse.json({ leads: [], detected: 0 });
    }

    const now = new Date().toISOString();
    const partialLeads: BDLead[] = detected.map((d) => ({
      id: uuidv4(),
      companyName: d.companyName ?? "Unknown Company",
      sector: (d.sector as BDLead["sector"]) ?? "general",
      signals: d.signals ?? [],
      overview: "",
      techStack: [],
      recentActivity: "",
      relevanceScore: d.initialRelevanceScore ?? 5,
      relevanceReason: "",
      hiringContact: { name: "", title: "", linkedInUrl: "" },
      confidence: "medium" as const,
      createdAt: now,
    }));

    try {
      await kv.set("bd:leads", partialLeads, { ex: 60 * 60 * 24 * 30 });
    } catch {}

    return NextResponse.json({ leads: partialLeads, detected: partialLeads.length });
  } catch (err) {
    console.error("bd/signals error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Signal detection failed" },
      { status: 500 }
    );
  }
}
