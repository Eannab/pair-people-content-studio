import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import { getSessionUser, uk, unauthorized } from "@/lib/user-key";
import type { BDLead } from "@/app/api/bd/signals/route";
import type { OutreachPreferences } from "@/app/api/bd/preferences/route";
import { getTopCVMatches } from "@/lib/cv-context";
import { getOutreachVoiceContext } from "@/lib/outreach-voice-context";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET — return the authenticated user's saved draft for this company
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { companyId } = await params;
  try {
    const draft = await kv.get<string>(uk(user.email, `bd:draft:${companyId}`));
    return NextResponse.json({ draft: draft ?? null });
  } catch {
    return NextResponse.json({ draft: null });
  }
}

// POST — generate and save a draft for the authenticated user
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  try {
    const { companyId } = await params;

    const [leads, preferences, outreachVoiceContext] = await Promise.all([
      kv.get<BDLead[]>("bd:leads"),
      kv.get<OutreachPreferences>(uk(user.email, "bd:outreach_preferences")).catch(() => null),
      getOutreachVoiceContext(user.email),
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

    const prefSection = preferences?.rawPreferences
      ? `\n\n${user.name}'s outreach preferences (from previous conversations):\n${preferences.rawPreferences}`
      : "";

    const voiceSection = outreachVoiceContext || "";

    // CV matches
    const cvMatches = await getTopCVMatches(lead, 1, 7);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Write a cold outreach email from Éanna (co-founder, Pair People) to the hiring contact at ${lead.companyName}.

Signal (use this as the opening hook — be specific, name the actual detail):
${hookContext}

Contact: ${lead.hiringContact.name || "the hiring manager"}, ${lead.hiringContact.title || ""}
${cvMatches.length > 0 ? `\nCandidate to introduce:\n${cvMatches.map((m) => `- ${m.candidate.name}, ${m.candidate.seniority} ${m.candidate.currentRole}, ${m.candidate.yearsExperience} years exp — ${m.fitExplanation}\n  Skills: ${m.candidate.skills?.slice(0, 6).join(", ") ?? ""}`).join("\n")}` : ""}
${voiceSection}${prefSection}

STRICT RULES — follow every one without exception:

1. MAXIMUM 100 WORDS TOTAL. Count carefully. Cut ruthlessly.

2. OPENING: Reference the specific signal detail (the exact funding amount, the exact role title, the exact product name). Not "saw you're hiring" or "noticed you're growing" — name the actual thing.

3. STRUCTURE:
   - 1 sentence: signal hook
   - 1 sentence: "I have a [role] who might be relevant" — introduce the candidate, not Pair People
   - 2-3 tight bullet points: candidate's specific skills, experience, and background ONLY
   - 1 closing line

4. BULLET POINTS: Only used for the candidate's credentials. Never for Pair People's services, process, or value proposition.

5. NEVER WRITE: "48-hour turnaround", "pre-vetted", "quality over volume", "boutique", "specialist in", "we work with", "our process", fees, turnaround times, or any description of Pair People as an agency.

6. CLOSING LINE: Must be exactly "Any interest in seeing their CV?" or "Worth 15 mins?" — nothing else.

7. SIGN OFF: "Cheers, Éanna" — no title, no phone number, no website, nothing else.

8. The email is about the CANDIDATE. Pair People is barely mentioned if at all.

Return ONLY the email body text. No subject line.`,
        },
      ],
    });

    const draft =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Store draft under the authenticated user's namespace
    await kv.set(uk(user.email, `bd:draft:${companyId}`), draft, {
      ex: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({ draft, cvMatches });
  } catch (err) {
    console.error("bd/draft error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Draft generation failed" },
      { status: 500 }
    );
  }
}
