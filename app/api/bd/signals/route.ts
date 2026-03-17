import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { v4 as uuidv4 } from "uuid";
import { detectBDSignals } from "@/lib/bd-signal-detection";
import type { ScoredArticle } from "@/app/api/newsletters/scan/route";
import { getPipelineAll, addPipelineLead } from "@/lib/pipeline-kv";

// ── Exported interfaces (used across the app) ─────────────────────────────────

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
  detail: string;
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
  // Source tracking
  sourceArticleTitle?: string;
  sourceNewsletter?: string;
  sourceDate?: string;
  sourceEmailLink?: string;
  // Company website & verification
  companyWebsite?: string;
  verified?: boolean;
}

export interface MarketInsightSignal {
  id: string;
  companyName: string;
  sector: "defence" | "ai" | "healthtech" | "sydney" | "general";
  signals: CompanySignal[];
  whyExcluded: string;
  postContext: string;
  createdAt: string;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST() {
  try {
    const articles = await kv.get<ScoredArticle[]>("newsletters:articles");

    if (!articles || articles.length === 0) {
      return NextResponse.json(
        { error: "No articles found. Run a newsletter scan first." },
        { status: 400 }
      );
    }

    const relevant = articles.filter((a) => a.topScore >= 4);
    if (relevant.length === 0) {
      return NextResponse.json({ leads: [], marketInsights: [], detected: 0 });
    }

    // Research-first signal detection: extract → web search → classify
    const { bdLeads, marketInsights } = await detectBDSignals(relevant);

    try {
      await kv.set("bd:leads", bdLeads, { ex: 60 * 60 * 24 * 30 });
      await kv.set("bd:market_insights", marketInsights, { ex: 60 * 60 * 24 * 30 });
    } catch {}

    // Auto-add new BD leads to the pipeline (preserve existing status/notes)
    try {
      const existingPipeline = await getPipelineAll();
      const pipelineNames = new Set(
        existingPipeline.map((p) => p.companyName.toLowerCase())
      );
      const toAdd = bdLeads.filter(
        (l) => !pipelineNames.has(l.companyName.toLowerCase())
      );
      if (toAdd.length > 0) {
        const now = new Date().toISOString();
        for (const l of toAdd) {
          await addPipelineLead({
            id: uuidv4(),
            companyId: l.id,
            companyName: l.companyName,
            sector: l.sector,
            signals: l.signals,
            relevanceScore: l.relevanceScore,
            dateAdded: now,
            status: "new",
            notes: "",
            updatedAt: now,
          });
        }
      }
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
