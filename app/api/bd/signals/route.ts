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

export interface AustraliaPresence {
  basedInAustralia: boolean;
  hiringInAustralia: boolean;
  detail: string; // e.g. "Sydney HQ", "Hiring remotely in AU", "Melbourne-based"
}

export interface BDLead {
  id: string;
  companyName: string;
  sector: "defence" | "ai" | "healthtech" | "sydney" | "general";
  signals: CompanySignal[];
  australiaPresence: AustraliaPresence;
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

export interface MarketInsightSignal {
  id: string;
  companyName: string;
  sector: "defence" | "ai" | "healthtech" | "sydney" | "general";
  signals: CompanySignal[];
  whyExcluded: string; // e.g. "Large enterprise (10,000+ employees)", "No AU presence detected"
  postContext: string; // pre-built context string for Create panel
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
      return NextResponse.json({ leads: [], marketInsights: [], detected: 0 });
    }

    const articleText = relevant
      .map(
        (a, i) =>
          `${i + 1}. [${a.topSector.toUpperCase()}] "${a.title}" (${a.source})\n   ${a.summary}`
      )
      .join("\n\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `You are a BD intelligence analyst for Pair People, a Sydney-based tech recruitment agency placing engineers and tech leaders in Australian startups and scale-ups (Defence/DeepTech, AI/ML, Healthtech, and the broader Sydney market).

Analyse these newsletter articles to find companies showing recruitment buying signals: funding announcements, active hiring, or product launches that typically precede engineering hiring.

Articles:
${articleText}

For each company with a concrete signal, classify it as either:

A) **BD Lead** — meets ALL criteria:
   1. Australian-based (HQ or main office in AU) OR actively hiring engineers in Australia
   2. Startup or scale-up: estimated under 200 employees

B) **Market Insight** — has notable news but does NOT meet BD criteria (large enterprise 200+ employees, global company with no AU hiring, etc.). These are still worth creating LinkedIn content about.

Return a single JSON object:
{
  "bdLeads": [
    {
      "companyName": "Acme AI",
      "sector": "ai",
      "signals": [
        {
          "type": "funded",
          "label": "Series A",
          "context": "exact quote or close paraphrase from article",
          "articleTitle": "article title",
          "articleSource": "newsletter name"
        }
      ],
      "australiaPresence": {
        "basedInAustralia": true,
        "hiringInAustralia": true,
        "detail": "Sydney HQ"
      },
      "initialRelevanceScore": 8
    }
  ],
  "marketInsights": [
    {
      "companyName": "OpenAI",
      "sector": "ai",
      "signals": [
        {
          "type": "launch",
          "label": "GPT-5 release",
          "context": "...",
          "articleTitle": "...",
          "articleSource": "..."
        }
      ],
      "whyExcluded": "Global company, 3000+ employees, no AU-specific hiring mentioned"
    }
  ]
}

Rules:
- Only include companies with concrete, specific signals — not vague mentions
- sector: "defence" | "ai" | "healthtech" | "sydney" | "general"
- signal type: "funded" | "hiring" | "launch"
- label examples: "Series A", "Seed Round", "CTO hire", "Head of Eng role", "Product launch"
- For australiaPresence: use article evidence first, then your knowledge; if uncertain set basedInAustralia: false, hiringInAustralia: false, detail: "Location unclear"
- whyExcluded: one sentence explaining why this is market insight only (company size, no AU presence, etc.)
- initialRelevanceScore 1-10 for bdLeads only
- Return ONLY the JSON object — no markdown fences, no preamble.`,
        },
      ],
    });

    const raw =
      response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
    const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let parsed: {
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
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json({ leads: [], marketInsights: [], detected: 0 });
    }

    const now = new Date().toISOString();

    // Build BD leads
    const bdLeads: BDLead[] = (parsed.bdLeads ?? []).map((d) => ({
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

    // Build market insights
    const marketInsights: MarketInsightSignal[] = (parsed.marketInsights ?? []).map((d) => {
      const topSignal = d.signals?.[0];
      const postContext = [
        `${d.companyName} — ${topSignal ? `${topSignal.label}: ${topSignal.context}` : "notable news"}`,
        d.signals.slice(1).map((s) => `${s.label}: ${s.context}`).join("\n"),
        topSignal ? `Source: ${topSignal.articleSource}` : "",
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

    try {
      await kv.set("bd:leads", bdLeads, { ex: 60 * 60 * 24 * 30 });
      await kv.set("bd:market_insights", marketInsights, { ex: 60 * 60 * 24 * 30 });
    } catch {}

    return NextResponse.json({
      leads: bdLeads,
      marketInsights,
      detected: bdLeads.length + marketInsights.length,
    });
  } catch (err) {
    console.error("bd/signals error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Signal detection failed" },
      { status: 500 }
    );
  }
}
