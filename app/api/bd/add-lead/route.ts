import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import { v4 as uuidv4 } from "uuid";
import { braveSearch, formatResults } from "@/lib/brave-search";
import { getTopCVMatches } from "@/lib/cv-context";
import type { BDLead, AustraliaPresence, CompanySignal } from "@/app/api/bd/signals/route";
import type { PipelineLead } from "@/app/api/bd/pipeline/route";
import type { OutreachPreferences } from "@/app/api/bd/preferences/route";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { companyName } = await request.json();
    if (!companyName?.trim()) {
      return NextResponse.json({ error: "companyName required" }, { status: 400 });
    }
    const name = companyName.trim();

    // ── Step 1: Web research ─────────────────────────────────────────────────

    const queries = [
      `"${name}" company employees headcount size location headquarters`,
      `"${name}" Australia Sydney Melbourne office hiring engineers`,
      `"${name}" funding news 2024 2025 product launch`,
      `"${name}" tech stack engineering technology`,
    ];

    const searchResults = await Promise.allSettled(
      queries.map((q) => braveSearch(q, 5))
    );

    const researchText = queries
      .map((q, i) => {
        const r = searchResults[i];
        if (r.status !== "fulfilled" || r.value.length === 0) return "";
        return `Search: ${q}\n${formatResults(r.value)}`;
      })
      .filter(Boolean)
      .join("\n\n---\n\n");

    // ── Step 2: Build company brief ──────────────────────────────────────────

    const briefRes = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `You are a BD analyst for Pair People, a Sydney tech recruitment agency. Build a company intelligence brief for "${name}" using this web research.

Web research:
${researchText || "No search results available — use your knowledge."}

Return JSON:
{
  "sector": "ai",
  "overview": "2-3 sentence description: what they do, stage, estimated size",
  "techStack": ["Python", "AWS"],
  "australiaPresence": {
    "basedInAustralia": true,
    "hiringInAustralia": true,
    "detail": "Evidence: e.g. Sydney HQ per LinkedIn"
  },
  "estimatedEmployees": 50,
  "recentActivity": "What's happening at this company right now that's relevant to hiring",
  "signals": [{"type": "funded", "label": "Series A", "context": "evidence from research", "articleTitle": "Manual add", "articleSource": "Web research"}],
  "relevanceScore": 7,
  "relevanceReason": "Why this company is a good fit for Pair People to approach",
  "hiringContact": {"name": "", "title": "CTO", "linkedInUrl": ""},
  "confidence": "medium"
}

sector: "defence" | "ai" | "healthtech" | "sydney" | "general"
confidence: "high" (clear evidence) | "medium" (some evidence) | "low" (minimal info found)
If signals array is empty, still return the company — manual adds always go to the pipeline.
Return ONLY the JSON object — no markdown fences, no preamble.`,
        },
      ],
    });

    const briefRaw =
      briefRes.content[0].type === "text" ? briefRes.content[0].text.trim() : "{}";
    const briefClean = briefRaw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let brief: {
      sector: BDLead["sector"];
      overview: string;
      techStack: string[];
      australiaPresence: AustraliaPresence;
      estimatedEmployees: number;
      recentActivity: string;
      signals: CompanySignal[];
      relevanceScore: number;
      relevanceReason: string;
      hiringContact: { name: string; title: string; linkedInUrl: string };
      confidence: BDLead["confidence"];
    } = {
      sector: "general",
      overview: "",
      techStack: [],
      australiaPresence: { basedInAustralia: false, hiringInAustralia: false, detail: "" },
      estimatedEmployees: 0,
      recentActivity: "",
      signals: [],
      relevanceScore: 5,
      relevanceReason: "",
      hiringContact: { name: "", title: "", linkedInUrl: "" },
      confidence: "medium",
    };

    try {
      const parsed = JSON.parse(briefClean);
      brief = { ...brief, ...parsed };
    } catch {}

    const now = new Date().toISOString();
    const leadId = uuidv4();

    const newLead: BDLead = {
      id: leadId,
      companyName: name,
      sector: brief.sector ?? "general",
      signals: brief.signals ?? [],
      australiaPresence: brief.australiaPresence,
      overview: brief.overview ?? "",
      techStack: brief.techStack ?? [],
      recentActivity: brief.recentActivity ?? "",
      relevanceScore: brief.relevanceScore ?? 5,
      relevanceReason: brief.relevanceReason ?? "",
      hiringContact: brief.hiringContact ?? { name: "", title: "", linkedInUrl: "" },
      confidence: brief.confidence ?? "medium",
      researchedAt: now,
      createdAt: now,
    };

    // ── Step 3: Generate outreach draft ──────────────────────────────────────

    const [cvMatches, preferences] = await Promise.all([
      getTopCVMatches(newLead, 2, 7),
      kv.get<OutreachPreferences>("bd:outreach_preferences").catch(() => null),
    ]);

    const cvSection =
      cvMatches.length > 0
        ? `\n\nMatched candidates from Pair People's active CV pool:${cvMatches
            .map(
              (m) =>
                `\n- ${m.candidate.name} (${m.candidate.seniority} ${m.candidate.currentRole}, ${m.candidate.yearsExperience}yr exp) — ${m.fitExplanation}`
            )
            .join("")}`
        : "";

    const prefSection = preferences?.rawPreferences
      ? `\n\nEanna's outreach preferences:\n${preferences.rawPreferences}`
      : "";

    const sectorSpecialism =
      newLead.sector === "ai"
        ? "AI/ML engineering"
        : newLead.sector === "defence"
        ? "defence and deep tech"
        : newLead.sector === "healthtech"
        ? "healthtech"
        : "Sydney tech";

    const signalHook = newLead.signals[0];
    const hookContext = signalHook
      ? `${signalHook.label}: ${signalHook.context}`
      : brief.recentActivity || "recent growth signals";

    const draftRes = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Write a cold outreach email from Eanna Barry (co-founder, Pair People) to the hiring contact at ${name}.

Company context:
- Overview: ${brief.overview || name}
- Tech stack: ${brief.techStack?.join(", ") || "unknown"}
- Signal: ${hookContext}
- Contact: ${brief.hiringContact?.name || "the hiring manager"}, ${brief.hiringContact?.title || "CTO/Head of Engineering"}
- Why reach out now: ${brief.relevanceReason || `relevant ${newLead.sector} company`}
${prefSection}${cvSection}

Write the email body only (no subject line). Requirements:
- 100-120 words total
- First sentence: research hook referencing the signal — show you've done your homework
- Next 1-2 sentences: introduce Eanna and Pair People — "boutique Sydney tech recruitment agency", specialist in ${sectorSpecialism} talent
- 3 bullet points on what Pair People offers (under 15 words each, concrete and specific)
- Closing: soft CTA for a 15-minute call, no pressure
- Sign off: Eanna
- Tone: direct, warm, confident. No fluff. No "I hope this finds you well." No "please don't hesitate."

Return ONLY the email body text.`,
        },
      ],
    });

    const draft =
      draftRes.content[0].type === "text" ? draftRes.content[0].text.trim() : "";
    newLead.outreachDraft = draft;
    newLead.outreachDraftedAt = now;

    // ── Step 4: Persist to KV ────────────────────────────────────────────────

    // Merge into bd:leads (skip if already exists)
    const existingLeads = (await kv.get<BDLead[]>("bd:leads")) ?? [];
    if (!existingLeads.some((l) => l.companyName.toLowerCase() === name.toLowerCase())) {
      await kv.set("bd:leads", [...existingLeads, newLead], {
        ex: 60 * 60 * 24 * 30,
      });
    }

    // Upsert into bd:pipeline
    const existingPipeline = (await kv.get<PipelineLead[]>("bd:pipeline")) ?? [];
    const alreadyInPipeline = existingPipeline.find(
      (p) => p.companyName.toLowerCase() === name.toLowerCase()
    );

    let pipelineEntry: PipelineLead;

    if (alreadyInPipeline) {
      pipelineEntry = alreadyInPipeline;
    } else {
      pipelineEntry = {
        id: uuidv4(),
        companyId: leadId,
        companyName: name,
        sector: newLead.sector,
        signals: newLead.signals,
        relevanceScore: newLead.relevanceScore,
        dateAdded: now,
        status: "new",
        notes: "",
        updatedAt: now,
      };
      await kv.set("bd:pipeline", [...existingPipeline, pipelineEntry]);
    }

    return NextResponse.json({ lead: newLead, pipelineEntry, draft, cvMatches });
  } catch (err) {
    console.error("bd/add-lead error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add lead" },
      { status: 500 }
    );
  }
}
