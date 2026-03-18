import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import type { BDLead, AustraliaPresence } from "@/app/api/bd/signals/route";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Domains that are aggregators/socials — not the company's own website
const AGGREGATOR_DOMAINS = new Set([
  "linkedin.com", "crunchbase.com", "angel.co", "angellist.com",
  "pitchbook.com", "glassdoor.com", "twitter.com", "x.com",
  "facebook.com", "instagram.com", "techcrunch.com", "bloomberg.com",
  "reuters.com", "forbes.com", "businesswire.com", "prnewswire.com",
  "tracxn.com", "owler.com", "zoominfo.com", "dnb.com",
  "wikipedia.org", "wikimedia.org", "github.com", "youtube.com",
]);

function isRealCompanyWebsite(url: string): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    const domain = hostname.replace(/^www\./, "");
    return !AGGREGATOR_DOMAINS.has(domain);
  } catch {
    return false;
  }
}

type ResearchResult = {
  overview: string;
  techStack: string[];
  recentActivity: string;
  relevanceScore: number;
  relevanceReason: string;
  australiaPresence?: AustraliaPresence;
  hiringContact: { name: string; title: string; linkedInUrl: string };
  companyWebsite?: string;
  verified?: boolean;
  confidence: "high" | "medium" | "low";
};

function parseResearchJson(raw: string): ResearchResult | null {
  const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  try {
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

const RESEARCH_SCHEMA = `{
  "overview": "2-3 sentence company description covering what they do, company stage, and Sydney/Australia relevance",
  "techStack": ["React", "Python", "AWS"],
  "recentActivity": "1-2 sentences on their most recent notable activity",
  "relevanceScore": 8,
  "relevanceReason": "one sharp sentence explaining why Pair People should reach out now",
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
  "companyWebsite": "https://acme.com",
  "confidence": "high"
}`;

const SCHEMA_RULES = `Rules:
- relevanceScore 1-10: urgency and value of this lead for Pair People specifically
- australiaPresence.detail: concise note on AU connection (e.g. "Sydney HQ", "Melbourne-based", "Hiring remotely in AU")
- hiringContact: most senior person for a recruitment pitch — CTO, VP Engineering, Head of Engineering, or Founder
- linkedInUrl: best guess at their LinkedIn profile URL, or "" if unknown
- companyWebsite: the company's OFFICIAL website (not LinkedIn, Crunchbase, or news sites). Use "" if not found.
- confidence: "high" if solid data, "medium" if reasonable inference, "low" if mostly estimated
- Return ONLY the JSON object — no markdown fences, no preamble.`;

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

    const sectorLabel =
      lead.sector === "ai" ? "AI/ML engineering" :
      lead.sector === "defence" ? "defence tech" :
      lead.sector === "healthtech" ? "healthtech" :
      "Sydney tech";

    const prompt = `Research ${lead.companyName} for Pair People, a Sydney tech recruitment agency placing engineers and tech leaders in ${sectorLabel}.

Known signals for this company:
${signalContext || `${lead.companyName} — a ${lead.sector} company`}

Use web search to find: their official website, tech stack, team size, Australia presence, and the best hiring contact (CTO / VP Eng / Head of Eng).

Return ONLY a JSON object:
${RESEARCH_SCHEMA}

${SCHEMA_RULES}`;

    // ── Primary path: Claude with web_search tool ─────────────────────────────
    let research: ResearchResult | null = null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wsResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }] as any,
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = wsResponse.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        research = parseResearchJson(textBlock.text);
      }
    } catch (wsErr) {
      console.warn("bd/research: Claude web search failed, falling back", wsErr);
    }

    // ── Fallback: signal-only brief (no web search) ───────────────────────────
    if (!research) {
      const fallbackResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `Write a brief company profile for ${lead.companyName} based only on the signal below. No web search available.

Known signals:
${signalContext || `${lead.companyName} — a ${lead.sector} company`}

Return ONLY a JSON object (no markdown fences):
{
  "overview": "1-2 sentences based strictly on the signal context",
  "techStack": [],
  "recentActivity": "based on the signal",
  "relevanceScore": 6,
  "relevanceReason": "one sentence on why this company may be relevant for tech recruitment",
  "australiaPresence": {"basedInAustralia": false, "hiringInAustralia": false, "detail": "Unknown — no search data"},
  "hiringContact": {"name": "", "title": "", "linkedInUrl": ""},
  "companyWebsite": "",
  "confidence": "low"
}`,
        }],
      });

      const fbText = fallbackResponse.content[0].type === "text"
        ? fallbackResponse.content[0].text : "{}";
      research = parseResearchJson(fbText) ?? ({} as ResearchResult);
    }

    // ── Determine verified from website quality ───────────────────────────────
    const websiteUrl = research.companyWebsite || "";
    const verified = isRealCompanyWebsite(websiteUrl);

    const now = new Date().toISOString();
    const updatedLead: BDLead = {
      ...lead,
      overview: research.overview || lead.overview,
      techStack: research.techStack || lead.techStack,
      recentActivity: research.recentActivity || lead.recentActivity,
      relevanceScore: research.relevanceScore ?? lead.relevanceScore,
      relevanceReason: research.relevanceReason || lead.relevanceReason,
      australiaPresence: research.australiaPresence ?? lead.australiaPresence,
      hiringContact: research.hiringContact || lead.hiringContact,
      companyWebsite: websiteUrl,
      verified,
      confidence: research.confidence || lead.confidence,
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
