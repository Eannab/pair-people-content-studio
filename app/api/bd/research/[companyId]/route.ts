import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import type { BDLead, AustraliaPresence } from "@/app/api/bd/signals/route";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function braveSearch(query: string): Promise<string> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return "";
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
      }
    );
    if (!res.ok) return "";
    const data = await res.json();
    const snippets = (data.web?.results ?? [])
      .slice(0, 5)
      .map(
        (r: { title: string; description: string; url: string }) =>
          `${r.title}: ${r.description} (${r.url})`
      )
      .join("\n");
    return snippets;
  } catch {
    return "";
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = await request.json().catch(() => ({})) as { companyName?: string };

    const leads = await kv.get<BDLead[]>("bd:leads") ?? [];
    let lead = leads.find((l) => l.id === companyId);

    if (!lead) {
      // Stub lead from View Brief fallback — create it inline using the provided name
      const companyName = body.companyName ?? companyId;
      lead = {
        id: companyId,
        companyName,
        sector: "general",
        signals: [],
        australiaPresence: { basedInAustralia: false, hiringInAustralia: false, detail: "" },
        overview: "",
        techStack: [],
        recentActivity: "",
        relevanceScore: 5,
        relevanceReason: "",
        hiringContact: { name: "", title: "", linkedInUrl: "" },
        confidence: "medium",
        createdAt: new Date().toISOString(),
      };
    }

    const signalContext = lead.signals
      .map((s) => `- ${s.type.toUpperCase()} (${s.label}): ${s.context} [from: ${s.articleTitle}]`)
      .join("\n");

    const searchResults = await braveSearch(
      `${lead.companyName} engineering team tech stack 2024 2025 hiring`
    );

    const searchSection = searchResults
      ? `\nWeb search results:\n${searchResults}\n`
      : "\n(No live search data — use your knowledge up to August 2025)\n";

    const sectorLabel =
      lead.sector === "ai"
        ? "AI/ML engineering"
        : lead.sector === "defence"
        ? "defence tech"
        : lead.sector === "healthtech"
        ? "healthtech"
        : "Sydney tech";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `Research ${lead.companyName} for Pair People, a Sydney tech recruitment agency placing engineers and tech leaders in ${sectorLabel}.

Known signals for this company:
${signalContext}
${searchSection}
Return a JSON object:
{
  "overview": "2-3 sentence company description covering what they do, company stage, and Sydney/Australia relevance",
  "techStack": ["React", "Python", "AWS"],
  "recentActivity": "1-2 sentences on their most recent notable activity (beyond the signal already captured)",
  "relevanceScore": 8,
  "relevanceReason": "one sharp sentence explaining why Pair People should reach out to this company right now",
  "australiaPresence": {
    "basedInAustralia": true,
    "hiringInAustralia": true,
    "detail": "Sydney HQ, Series A team of ~30"
  },
  "hiringContact": {
    "name": "Jane Smith",
    "title": "CTO",
    "linkedInUrl": "https://linkedin.com/in/janesmith"
  },
  "confidence": "high"
}

Rules:
- relevanceScore 1-10: urgency and value of this lead for Pair People specifically
- australiaPresence.detail: concise note on AU connection (e.g. "Sydney HQ", "Melbourne-based", "Hiring remotely in AU", "AU subsidiary"); use your best knowledge
- hiringContact: the most senior person likely to receive a recruitment pitch — CTO, VP Engineering, Head of Engineering, or Founder for early-stage
- linkedInUrl: your best guess at their LinkedIn profile URL, or empty string "" if genuinely unknown
- confidence: "high" if you have solid data, "medium" if reasonable inference, "low" if mostly estimated
- Return ONLY the JSON object — no markdown fences, no preamble.`,
        },
      ],
    });

    const raw =
      response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
    const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let research: {
      overview: string;
      techStack: string[];
      recentActivity: string;
      relevanceScore: number;
      relevanceReason: string;
      australiaPresence?: AustraliaPresence;
      hiringContact: { name: string; title: string; linkedInUrl: string };
      confidence: "high" | "medium" | "low";
    } | null = null;

    try {
      research = JSON.parse(clean);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse research response" },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();
    const updatedLead: BDLead = {
      ...lead,
      overview: research!.overview || lead.overview,
      techStack: research!.techStack || lead.techStack,
      recentActivity: research!.recentActivity || lead.recentActivity,
      relevanceScore: research!.relevanceScore ?? lead.relevanceScore,
      relevanceReason: research!.relevanceReason || lead.relevanceReason,
      // Refine australiaPresence if research found better data
      australiaPresence: research!.australiaPresence ?? lead.australiaPresence,
      hiringContact: research!.hiringContact || lead.hiringContact,
      confidence: research!.confidence || lead.confidence,
      researchedAt: now,
    };

    const exists = leads.some((l) => l.id === companyId);
    const updatedLeads = exists
      ? leads.map((l) => (l.id === companyId ? updatedLead : l))
      : [...leads, updatedLead];

    try {
      await kv.set("bd:leads", updatedLeads, { ex: 60 * 60 * 24 * 30 });
    } catch {}

    return NextResponse.json({ lead: updatedLead });
  } catch (err) {
    console.error("bd/research error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Research failed" },
      { status: 500 }
    );
  }
}
