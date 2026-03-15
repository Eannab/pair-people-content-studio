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

    // CV matches — pick top 1, pre-compute relevant skill overlap
    const cvMatches = await getTopCVMatches(lead, 1, 7);
    const candidate = cvMatches[0]?.candidate ?? null;

    // Cross-reference: only surface skills that map to the company's tech stack
    const leadStack = lead.techStack.map((t) => t.toLowerCase());
    const relevantSkills = candidate
      ? candidate.skills.filter((s) =>
          leadStack.some(
            (t) =>
              t.includes(s.toLowerCase()) || s.toLowerCase().includes(t)
          )
        )
      : [];
    // Fall back to top skills if overlap is thin
    const skillsToShow =
      relevantSkills.length >= 2
        ? relevantSkills.slice(0, 5)
        : (candidate?.skills ?? []).slice(0, 5);

    // Extract hiring role from signal context if signal type is "hiring"
    const hiringRole =
      signalHook?.type === "hiring" ? signalHook.context : "";

    // Employer line — "currently at X" or "just left X"
    const employerLine =
      candidate?.currentEmployer
        ? `currently at ${candidate.currentEmployer}`
        : "";

    const candidateBlock = candidate
      ? `Candidate to pitch:
- Name: ${candidate.name}
- Role: ${candidate.seniority} ${candidate.currentRole}${employerLine ? `, ${employerLine}` : ""}
- Experience: ${candidate.yearsExperience} years
- Relevant skills (matched to ${lead.companyName}'s stack): ${skillsToShow.join(", ")}
- Fit reason: ${cvMatches[0].fitExplanation}`
      : "";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Write a cold outreach email from Éanna (co-founder, Pair People) to the hiring contact at ${lead.companyName}.

COMPANY CONTEXT — use this to write the opening:
- What they build: ${lead.overview || `${lead.companyName} — a ${lead.sector} company`}
- Tech stack: ${lead.techStack.join(", ") || "unknown"}
- Signal: ${hookContext}${hiringRole ? `\n- Role they're hiring for: ${hiringRole}` : ""}
- Recent activity: ${lead.recentActivity || ""}

Contact: ${lead.hiringContact.name || "the hiring manager"}${lead.hiringContact.title ? `, ${lead.hiringContact.title}` : ""}

${candidateBlock}
${voiceSection}${prefSection}

STRICT RULES — follow every one without exception:

1. MAXIMUM 100 WORDS TOTAL. Count carefully. Cut ruthlessly.

2. OPENING: Describe what ${lead.companyName} specifically builds or does — use the "What they build" field above. Write it as if you've actually looked at the company. Never open with "I saw your job posting" or "noticed you're growing". Lead with the product/platform/technology they're building.
   Example format: "Saw [Company] is building [specific product] on [tech] — [brief why it's interesting]."

3. HIRING ROLE: If a role is listed above, reference it specifically (e.g. "building out your [role] team").

4. STRUCTURE:
   - 1 sentence: what the company builds + why you're reaching out now
   - 1 sentence: introduce the candidate by name, role, and current/recent employer
   - 2-3 tight bullet points: candidate's skills and experience that are directly relevant to ${lead.companyName}'s stack
   - 1 closing line

5. CANDIDATE INTRO SENTENCE must include their current or most recent employer if known: "I have [Name], a [seniority] [role] currently at [Employer]" or "just left [Employer]".

6. BULLET POINTS: Only used for the candidate's specific skills, experience, and background. Never for Pair People's services, process, or value proposition.

7. NEVER WRITE: "48-hour turnaround", "pre-vetted", "quality over volume", "boutique", "specialist in", "we work with", "our process", fees, turnaround times, or any description of Pair People as an agency.

8. CLOSING LINE: Must be exactly "Any interest in seeing their CV?" or "Worth 15 mins?" — nothing else.

9. SIGN OFF: "Cheers, Éanna" — no title, no phone number, no website, nothing else.

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
