import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import type { BDLead } from "@/app/api/bd/signals/route";
import type { OutreachPreferences } from "@/app/api/bd/preferences/route";
import { getTopCVMatches } from "@/lib/cv-context";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    const [leads, preferences] = await Promise.all([
      kv.get<BDLead[]>("bd:leads"),
      kv.get<OutreachPreferences>("bd:outreach_preferences").catch(() => null),
    ]);


    if (!leads) {
      return NextResponse.json({ error: "No leads found" }, { status: 404 });
    }

    const lead = leads.find((l) => l.id === companyId);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const signalHook = lead.signals[0];
    const hookContext = signalHook
      ? `${signalHook.label}: ${signalHook.context}`
      : lead.signals.map((s) => s.label).join(", ");

    const sectorSpecialism =
      lead.sector === "ai"
        ? "AI/ML engineering"
        : lead.sector === "defence"
        ? "defence and deep tech"
        : lead.sector === "healthtech"
        ? "healthtech"
        : "Sydney tech";

    const prefSection = preferences?.rawPreferences
      ? `\n\nEanna's outreach preferences (from previous conversations):\n${preferences.rawPreferences}`
      : "";

    // CV matches
    const cvMatches = await getTopCVMatches(lead, 2, 7);
    const cvSection =
      cvMatches.length > 0
        ? `\n\nMatched candidates from Pair People's active CV pool (include a brief mention in the email — e.g. "We have [X] immediately available"):${cvMatches
            .map(
              (m) =>
                `\n- ${m.candidate.name} (${m.candidate.seniority} ${m.candidate.currentRole}, ${m.candidate.yearsExperience}yr exp) — ${m.fitExplanation}`
            )
            .join("")}`
        : "";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Write a cold outreach email from Eanna Barry (co-founder, Pair People) to the hiring contact at ${lead.companyName}.

Company context:
- Overview: ${lead.overview || `${lead.companyName} — a ${lead.sector} company`}
- Tech stack: ${lead.techStack.length > 0 ? lead.techStack.join(", ") : "unknown"}
- Signal: ${hookContext}
- Contact: ${lead.hiringContact.name || "the hiring manager"}, ${lead.hiringContact.title || "CTO/Head of Engineering"}
- Why reach out now: ${lead.relevanceReason || `strong signal in ${lead.sector}`}
${prefSection}${cvSection}

Write the email body only (no subject line). Requirements:
- 100-120 words total
- First sentence: a research hook referencing the signal (funding round, product launch, or new hire) — show you've done your homework
- Next 1-2 sentences: introduce Eanna and Pair People in third person — "boutique Sydney tech recruitment agency", quality over volume, specialist in ${sectorSpecialism} talent
- 3 bullet points on what Pair People offers (under 15 words each, concrete and specific)
- Closing: soft CTA for a 15-minute call, no pressure
- Sign off: Eanna
- Tone: direct, warm, confident. No fluff. No "I hope this finds you well." No "please don't hesitate."

Return ONLY the email body text.`,
        },
      ],
    });

    const draft =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";

    const now = new Date().toISOString();
    const updatedLead: BDLead = {
      ...lead,
      outreachDraft: draft,
      outreachDraftedAt: now,
    };

    const updatedLeads = leads.map((l) => (l.id === companyId ? updatedLead : l));
    try {
      await kv.set("bd:leads", updatedLeads, { ex: 60 * 60 * 24 * 30 });
    } catch {}

    return NextResponse.json({ draft, lead: updatedLead, cvMatches });
  } catch (err) {
    console.error("bd/draft error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Draft generation failed" },
      { status: 500 }
    );
  }
}
