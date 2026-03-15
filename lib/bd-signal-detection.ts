/**
 * Shared BD signal detection logic used by both:
 *   - app/api/bd/signals/route.ts   (newsletter scan flow)
 *   - app/api/newsletters/manual/route.ts  (manual article drop flow)
 *
 * Three-step pipeline:
 *   1. Haiku: extract company names + signals from articles (fast, cheap)
 *   2. Brave Search: research each company's actual size + AU presence
 *   3. Sonnet: classify as bdLead / marketInsight using evidence from research
 *
 * No company is dismissed on Claude's training knowledge alone — research first.
 */

import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import { braveSearch, formatResults } from "@/lib/brave-search";
import type { ScoredArticle } from "@/app/api/newsletters/scan/route";
import type {
  BDLead,
  MarketInsightSignal,
  CompanySignal,
  AustraliaPresence,
} from "@/app/api/bd/signals/route";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Step 1: Extract companies from articles ───────────────────────────────────

interface ExtractedCompany {
  companyName: string;
  sector: string;
  signals: CompanySignal[];
  articleContext: string; // one-line summary of what the article said
}

async function extractCompanies(articles: ScoredArticle[]): Promise<ExtractedCompany[]> {
  const articleText = articles
    .map(
      (a, i) =>
        `${i + 1}. [${a.topSector.toUpperCase()}] "${a.title}" (${a.source})\n   ${a.summary}`
    )
    .join("\n\n");

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `Extract companies with recruitment buying signals from these articles.

Only include companies with concrete, specific signals: funding announcements, active hiring, or product launches that typically precede engineering hiring.

Articles:
${articleText}

Return a JSON array:
[{
  "companyName": "Acme AI",
  "sector": "ai",
  "signals": [{"type": "funded", "label": "Series A", "context": "raised $10M Series A", "articleTitle": "...", "articleSource": "..."}],
  "articleContext": "One sentence: what the article said about this company and why it signals hiring"
}]

sector: "defence" | "ai" | "healthtech" | "sydney" | "general"
signal type: "funded" | "hiring" | "launch"
Return ONLY the JSON array — no markdown fences, no preamble.`,
      },
    ],
  });

  const raw = res.content[0].type === "text" ? res.content[0].text.trim() : "[]";
  const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  try {
    return JSON.parse(clean);
  } catch {
    return [];
  }
}

// ── Step 2: Research each company with Brave Search ───────────────────────────

async function researchCompany(companyName: string): Promise<string> {
  const queries = [
    `"${companyName}" company employees headcount size location headquarters`,
    `"${companyName}" Australia Sydney Melbourne office hiring engineers`,
  ];

  const results = await Promise.allSettled(queries.map((q) => braveSearch(q, 4)));

  const snippets = queries
    .map((q, i) => {
      const r = results[i];
      if (r.status !== "fulfilled" || r.value.length === 0) return "";
      return `Query: ${q}\n${formatResults(r.value)}`;
    })
    .filter(Boolean);

  return snippets.join("\n\n---\n\n");
}

// ── Step 3: Classify with evidence ───────────────────────────────────────────

interface ClassifiedResult {
  bdLeads: Array<{
    companyName: string;
    sector: string;
    signals: CompanySignal[];
    australiaPresence: AustraliaPresence;
    initialRelevanceScore: number;
    researchSummary: string;
  }>;
  marketInsights: Array<{
    companyName: string;
    sector: string;
    signals: CompanySignal[];
    whyExcluded: string;
  }>;
}

async function classifyWithEvidence(
  companies: Array<ExtractedCompany & { research: string }>
): Promise<ClassifiedResult> {
  const companyBlocks = companies
    .map(
      (c, i) => `Company ${i + 1}: ${c.companyName}
Sector: ${c.sector}
Article signal: ${c.articleContext}
Signals: ${c.signals.map((s) => `${s.type}: ${s.label} — ${s.context}`).join("; ")}
Web research:
${c.research ? c.research.substring(0, 900) : "No search results found."}`
    )
    .join("\n\n---\n\n");

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: `You are a BD intelligence analyst for Pair People, a Sydney tech recruitment agency placing engineers and tech leaders in Australian startups and scale-ups.

For each company below you have: the article signal AND web research about the company's actual size and location.

Use the web research to make an evidence-based classification. Default to including as a bdLead when research is inconclusive — it is better to investigate a false positive than miss a real opportunity.

Classify each company as:
A) bdLead — Australian-based OR actively hiring in Australia, AND likely under 200 employees based on research
B) marketInsight — research clearly shows: large enterprise (200+ employees), or definitively no AU connection

Companies:
${companyBlocks}

Return a single JSON object:
{
  "bdLeads": [{
    "companyName": "...",
    "sector": "ai",
    "signals": [{"type": "funded", "label": "Series A", "context": "...", "articleTitle": "...", "articleSource": "..."}],
    "australiaPresence": {
      "basedInAustralia": true,
      "hiringInAustralia": true,
      "detail": "Evidence from research: Sydney HQ per LinkedIn"
    },
    "initialRelevanceScore": 8,
    "researchSummary": "1-2 sentences on what the research revealed about size and AU presence"
  }],
  "marketInsights": [{
    "companyName": "...",
    "sector": "ai",
    "signals": [...],
    "whyExcluded": "Research confirms: [specific evidence — e.g. '3,000 employees per Crunchbase', 'US-only company with no AU hiring']"
  }]
}

Rules:
- If research is ambiguous or returns no results, classify as bdLead
- whyExcluded must cite specific evidence from the research, not Claude's training assumptions
- sector: "defence" | "ai" | "healthtech" | "sydney" | "general"
- signal type: "funded" | "hiring" | "launch"
- Return ONLY the JSON object — no markdown fences, no preamble.`,
      },
    ],
  });

  const raw = res.content[0].type === "text" ? res.content[0].text.trim() : "{}";
  const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  try {
    return JSON.parse(clean);
  } catch {
    return { bdLeads: [], marketInsights: [] };
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

export interface SignalDetectionResult {
  bdLeads: BDLead[];
  marketInsights: MarketInsightSignal[];
}

export async function detectBDSignals(
  articles: ScoredArticle[]
): Promise<SignalDetectionResult> {
  // Step 1: Extract companies
  const companies = await extractCompanies(articles);
  if (companies.length === 0) return { bdLeads: [], marketInsights: [] };

  // Deduplicate by name
  const unique = companies.filter(
    (c, i, arr) =>
      arr.findIndex(
        (x) => x.companyName.toLowerCase() === c.companyName.toLowerCase()
      ) === i
  );

  // Step 2: Research each company in parallel (degrading gracefully on failure)
  const researchSettled = await Promise.allSettled(
    unique.map((c) => researchCompany(c.companyName))
  );

  const withResearch = unique.map((c, i) => ({
    ...c,
    research:
      researchSettled[i].status === "fulfilled"
        ? (researchSettled[i] as PromiseFulfilledResult<string>).value
        : "",
  }));

  // Step 3: Classify using article signals + research evidence
  const classified = await classifyWithEvidence(withResearch);

  const now = new Date().toISOString();

  const bdLeads: BDLead[] = (classified.bdLeads ?? []).map((d) => ({
    id: uuidv4(),
    companyName: d.companyName ?? "Unknown Company",
    sector: (d.sector as BDLead["sector"]) ?? "general",
    signals: d.signals ?? [],
    australiaPresence: d.australiaPresence ?? {
      basedInAustralia: false,
      hiringInAustralia: false,
      detail: "Location unclear",
    },
    overview: d.researchSummary ?? "",
    techStack: [],
    recentActivity: "",
    relevanceScore: d.initialRelevanceScore ?? 5,
    relevanceReason: d.researchSummary ?? "",
    hiringContact: { name: "", title: "", linkedInUrl: "" },
    confidence: "medium" as const,
    createdAt: now,
  }));

  const marketInsights: MarketInsightSignal[] = (classified.marketInsights ?? []).map((d) => {
    const topSignal = d.signals?.[0];
    const postContext = [
      `${d.companyName} — ${topSignal ? `${topSignal.label}: ${topSignal.context}` : "notable news"}`,
      d.signals
        .slice(1)
        .map((s) => `${s.label}: ${s.context}`)
        .join("\n"),
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

  return { bdLeads, marketInsights };
}
