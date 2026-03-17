import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import { getSessionUser, uk, unauthorized } from "@/lib/user-key";
import type { BDLead } from "@/app/api/bd/signals/route";
import type { OutreachPreferences } from "@/app/api/bd/preferences/route";
import { getTopCVMatches } from "@/lib/cv-context";
import { getOutreachVoiceContext } from "@/lib/outreach-voice-context";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function draftKey(email: string, companyId: string, type: "candidate" | "intro") {
  const suffix = type === "intro" ? ":intro" : "";
  return uk(email, `bd:draft:${companyId}${suffix}`);
}

// GET — return the authenticated user's saved draft for this company
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { companyId } = await params;
  const type = (request.nextUrl.searchParams.get("type") ?? "candidate") as "candidate" | "intro";
  try {
    const draft = await kv.get<string>(draftKey(user.email, companyId, type));
    return NextResponse.json({ draft: draft ?? null });
  } catch {
    return NextResponse.json({ draft: null });
  }
}

// POST — generate and save a draft for the authenticated user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  try {
    const { companyId } = await params;
    const body = await request.json().catch(() => ({})) as { type?: "candidate" | "intro"; candidateIndex?: number };
    const type: "candidate" | "intro" = body.type ?? "candidate";
    const candidateIndex = Math.max(0, body.candidateIndex ?? 0);

    const [leads, preferences, outreachVoiceContext] = await Promise.all([
      kv.get<BDLead[]>("bd:leads"),
      kv.get<OutreachPreferences>(uk(user.email, "bd:outreach_preferences")).catch(() => null),
      getOutreachVoiceContext(user.email),
    ]);

    // Allow stub leads (not in bd:leads) to still generate intro drafts
    const lead = leads?.find((l) => l.id === companyId) ?? null;
    if (!lead && leads !== null) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (!lead) {
      return NextResponse.json({ error: "No leads found" }, { status: 404 });
    }

    const signalHook = lead.signals[0];
    const hookContext = signalHook
      ? `${signalHook.label}: ${signalHook.context}`
      : lead.signals.map((s) => s.label).join(", ");

    const prefSection = preferences?.rawPreferences
      ? `\n\n${user.name}'s outreach preferences (from previous conversations):\n${preferences.rawPreferences}`
      : "";

    const voiceSection = outreachVoiceContext || "";

    let promptContent: string;
    let cvMatches: ReturnType<typeof getTopCVMatches> extends Promise<infer T> ? T : never = [];

    if (type === "candidate") {
      // ── Option 1: Candidate Sell ──────────────────────────────────────────────
      cvMatches = await getTopCVMatches(lead, 3, 7);
      const candidate = cvMatches[candidateIndex]?.candidate ?? cvMatches[0]?.candidate ?? null;
      const matchUsed = cvMatches[candidateIndex] ?? cvMatches[0] ?? null;

      const leadStack = lead.techStack.map((t) => t.toLowerCase());
      const relevantSkills = candidate
        ? candidate.skills.filter((s) =>
            leadStack.some(
              (t) => t.includes(s.toLowerCase()) || s.toLowerCase().includes(t)
            )
          )
        : [];
      const skillsToShow =
        relevantSkills.length >= 2
          ? relevantSkills.slice(0, 5)
          : (candidate?.skills ?? []).slice(0, 5);

      const hiringRole = signalHook?.type === "hiring" ? signalHook.context : "";
      const growthSignal =
        signalHook?.type !== "hiring"
          ? `${signalHook?.label ?? ""}: ${signalHook?.context ?? ""}`.trim()
          : "";

      const employerLine = candidate?.currentEmployer
        ? `currently at ${candidate.currentEmployer}`
        : "";

      // Strip candidate name from the fit reason — identity stays confidential in the email
      const anonFitReason = matchUsed
        ? matchUsed.fitExplanation.replace(
            new RegExp(candidate!.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
            "this candidate"
          )
        : "";

      const candidateBlock = candidate
        ? `Candidate to pitch (CONFIDENTIAL — never include their name in the email):
- Role: ${candidate.seniority} ${candidate.currentRole}${employerLine ? `, ${employerLine}` : ""}
- Experience: ${candidate.yearsExperience} years
- Relevant skills (matched to ${lead.companyName}'s stack): ${skillsToShow.join(", ")}
- Why they match: ${anonFitReason}`
        : "";

      promptContent = `Write a cold outreach email from Éanna (co-founder, Pair People) to the hiring contact at ${lead.companyName}.

COMPANY CONTEXT:
- What they build: ${lead.overview || `${lead.companyName} — a ${lead.sector} company`}
- Tech stack: ${lead.techStack.join(", ") || "unknown"}
- Sector: ${lead.sector}${hiringRole ? `\n- Open role: ${hiringRole}` : ""}${growthSignal ? `\n- Growth signal: ${growthSignal}` : ""}
- Recent activity: ${lead.recentActivity || ""}

Contact: ${lead.hiringContact.name || "the hiring manager"}${lead.hiringContact.title ? `, ${lead.hiringContact.title}` : ""}

${candidateBlock}
${voiceSection}${prefSection}

STRICT RULES — follow every one without exception:

CONFIDENTIALITY: Never use the candidate's name in the email. Refer to them by role, seniority, and employer only. Their identity is not disclosed until the client engages.

1. MAXIMUM 100 WORDS TOTAL. Count carefully. Cut ruthlessly.

2. OPENING — two cases, pick the right one:

   A) IF an open role is listed above: open by describing what ${lead.companyName} builds, then reference the specific role. Example: "Saw ${lead.companyName} is building [product] and hiring a [role] — thought this person might be worth a look."

   B) IF no open role (only a funding/launch/expansion signal): open with what the company builds and the growth signal, then position the candidate as relevant to where they're heading — not what they're currently posting. Example: "Saw ${lead.companyName} just [signal detail] — timing might be good." Do NOT mention job postings. Do NOT imply they're actively hiring.

   In both cases: never open with "I saw your job posting", "noticed you're growing", or any generic hiring observation. Lead with the product/platform.

3. CANDIDATE RELEVANCE — two cases:

   A) IF open role: connect the candidate's skills directly to the role requirements.

   B) IF no open role: connect the candidate's sector experience and tech stack to what the company builds. A ${lead.sector} engineer with ${lead.techStack.slice(0, 2).join("/")} experience is relevant to ${lead.companyName} regardless of whether they're actively hiring. Make this the angle.

4. STRUCTURE:
   - 1 sentence: what the company builds + the hook (role or growth signal)
   - 1 sentence: introduce the candidate by role and current/recent employer — NO name
   - 2-3 tight bullet points: candidate's skills and experience relevant to ${lead.companyName}'s stack and sector
   - 1 closing line

5. CANDIDATE INTRO SENTENCE: "I have a [seniority] [role] currently at [Employer]" — never include their name. Example: "I have a Senior Hardware Engineer currently at Intel who's immediately available."

6. BULLET POINTS: Only used for the candidate's specific skills, experience, and background. Never for Pair People's services, process, or value proposition.

7. NEVER WRITE: "48-hour turnaround", "pre-vetted", "quality over volume", "boutique", "specialist in", "we work with", "our process", fees, turnaround times, or any description of Pair People as an agency.

8. CLOSING LINE: Must be exactly "Any interest in seeing their CV?" or "Worth 15 mins?" — nothing else.

9. SIGN OFF: "Cheers, Éanna" — no title, no phone number, no website, nothing else.

Return ONLY the email body text. No subject line.`;

    } else {
      // ── Option 2: Intro Outreach (no candidate) ───────────────────────────────
      promptContent = `Write a cold outreach email from Éanna (co-founder, Pair People) to the hiring contact at ${lead.companyName}.

This email introduces Pair People — do NOT mention a specific candidate. The goal is to open a conversation about their hiring needs, not to pitch a specific person.

COMPANY CONTEXT:
- What they build: ${lead.overview || `${lead.companyName} — a ${lead.sector} company`}
- Sector: ${lead.sector}
- Signal: ${hookContext || "notable growth activity"}
- Recent activity: ${lead.recentActivity || ""}

Contact: ${lead.hiringContact.name || "the hiring manager"}${lead.hiringContact.title ? `, ${lead.hiringContact.title}` : ""}

ABOUT PAIR PEOPLE (weave these in naturally — do not list them like a brochure):
- Sydney-based tech recruitment, specialising in startups and scaleups
- Deep understanding of the AU tech ecosystem and the hiring challenges at early/growth stage
- Fixed fee structure — not percentage-based, so no incentive to push salaries up
- Network of vetted tech candidates across engineering, data, AI, and product

${voiceSection}${prefSection}

STRICT RULES:

1. MAXIMUM 100 WORDS TOTAL. Count carefully. Cut ruthlessly.

2. OPENING: Lead with what ${lead.companyName} builds + the specific signal (${hookContext || "their recent growth"}). Show you've done the research. Don't open with "I" or a generic line.

3. MIDDLE: One tight sentence on why we're reaching out — we specialise in placing tech talent into AU startups and scaleups at exactly this stage. Weave in 1-2 Pair People differentiators naturally (especially fixed fee — it's a genuine differentiator from the big agencies).

4. TONE: Warm and direct, like a peer who follows the space — not a sales pitch, not a template. Avoid agency-speak.

5. CLOSING: Low-commitment ask — "Worth a quick chat?" or "Open to a conversation?"

6. SIGN OFF: "Cheers, Éanna" — no title, no phone number, no website, nothing else.

Return ONLY the email body text. No subject line.`;
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [{ role: "user", content: promptContent }],
    });

    const draft =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";

    await kv.set(draftKey(user.email, companyId, type), draft, {
      ex: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({ draft, cvMatches, type });
  } catch (err) {
    console.error("bd/draft error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Draft generation failed" },
      { status: 500 }
    );
  }
}
