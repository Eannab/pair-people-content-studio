import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import { getSessionUser, uk, unauthorized } from "@/lib/user-key";
import type { BDLead } from "@/app/api/bd/signals/route";
import type { OutreachPreferences } from "@/app/api/bd/preferences/route";
import { getTopCVMatches } from "@/lib/cv-context";
import { getOutreachVoiceContext } from "@/lib/outreach-voice-context";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type DraftType = "candidate" | "intro";
type Channel = "email" | "linkedin" | "text";

function draftKey(userEmail: string, companyId: string, type: DraftType, channel: Channel = "email") {
  const channelSuffix = channel !== "email" ? `:${channel}` : "";
  const typeSuffix = type === "intro" ? ":intro" : "";
  return uk(userEmail, `bd:draft:${companyId}${channelSuffix}${typeSuffix}`);
}

// GET — return saved draft (defaults to email channel for backward compat)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { companyId } = await params;
  const type = (request.nextUrl.searchParams.get("type") ?? "candidate") as DraftType;
  const channel = (request.nextUrl.searchParams.get("channel") ?? "email") as Channel;
  try {
    const draft = await kv.get<string>(draftKey(user.email, companyId, type, channel));
    return NextResponse.json({ draft: draft ?? null });
  } catch {
    return NextResponse.json({ draft: null });
  }
}

// POST — generate (and save) a draft
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  try {
    const { companyId } = await params;
    const body = await request.json().catch(() => ({})) as {
      type?: DraftType;
      channel?: Channel;
      candidateIndex?: number;
      followUp?: boolean;
      originalMessage?: string;
    };

    const type: DraftType = body.type ?? "candidate";
    const channel: Channel = body.channel ?? "email";
    const candidateIndex = Math.max(0, body.candidateIndex ?? 0);
    const isFollowUp = body.followUp ?? false;
    const originalMessage = body.originalMessage ?? "";

    const [leads, preferences, outreachVoiceContext] = await Promise.all([
      kv.get<BDLead[]>("bd:leads"),
      kv.get<OutreachPreferences>(uk(user.email, "bd:outreach_preferences")).catch(() => null),
      getOutreachVoiceContext(user.email),
    ]);

    const lead = leads?.find((l) => l.id === companyId) ?? null;
    if (!lead && leads !== null) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    if (!lead) return NextResponse.json({ error: "No leads found" }, { status: 404 });

    const signalHook = lead.signals[0];
    const hookContext = signalHook
      ? `${signalHook.label}: ${signalHook.context}`
      : lead.signals.map((s) => s.label).join(", ");

    const prefSection = preferences?.rawPreferences
      ? `\n\n${user.name}'s outreach preferences:\n${preferences.rawPreferences}`
      : "";
    const voiceSection = outreachVoiceContext || "";

    const contactName = lead.hiringContact.name || "the hiring manager";
    const contactTitle = lead.hiringContact.title ? `, ${lead.hiringContact.title}` : "";
    const contactLine = `${contactName}${contactTitle}`;
    const firstName = lead.hiringContact.name?.split(" ")[0] || "there";

    // ── Build candidate context ───────────────────────────────────────────────
    let cvMatches: ReturnType<typeof getTopCVMatches> extends Promise<infer T> ? T : never = [];
    let candidateBlock = "";

    if (type === "candidate") {
      cvMatches = await getTopCVMatches(lead, 3, 7);
      const candidate = cvMatches[candidateIndex]?.candidate ?? cvMatches[0]?.candidate ?? null;
      const matchUsed = cvMatches[candidateIndex] ?? cvMatches[0] ?? null;

      if (candidate) {
        const leadStack = lead.techStack.map((t) => t.toLowerCase());
        const relevantSkills = candidate.skills.filter((s) =>
          leadStack.some((t) => t.includes(s.toLowerCase()) || s.toLowerCase().includes(t))
        );
        const skillsToShow =
          relevantSkills.length >= 2 ? relevantSkills.slice(0, 5) : candidate.skills.slice(0, 5);

        const employerLine = candidate.currentEmployer ? `currently at ${candidate.currentEmployer}` : "";

        const anonFitReason = matchUsed
          ? matchUsed.fitExplanation.replace(
              new RegExp(candidate.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
              "this candidate"
            )
          : "";

        candidateBlock = `Candidate to pitch (CONFIDENTIAL — never include their name in the message):
- Role: ${candidate.seniority} ${candidate.currentRole}${employerLine ? `, ${employerLine}` : ""}
- Experience: ${candidate.yearsExperience} years
- Relevant skills (matched to ${lead.companyName}'s stack): ${skillsToShow.join(", ")}
- Why they match: ${anonFitReason}`;
      }
    }

    // ── Shared company context ────────────────────────────────────────────────
    const hiringRole = signalHook?.type === "hiring" ? signalHook.context : "";
    const growthSignal =
      signalHook?.type !== "hiring"
        ? `${signalHook?.label ?? ""}: ${signalHook?.context ?? ""}`.trim()
        : "";

    const companyCtx = `- What they build: ${lead.overview || `${lead.companyName} — a ${lead.sector} company`}
- Tech stack: ${lead.techStack.join(", ") || "unknown"}
- Sector: ${lead.sector}${hiringRole ? `\n- Open role: ${hiringRole}` : ""}${growthSignal ? `\n- Growth signal: ${growthSignal}` : ""}
- Recent activity: ${lead.recentActivity || ""}`;

    // ── Dispatch to prompt builder ────────────────────────────────────────────
    let promptContent: string;
    let maxTokens: number;

    if (isFollowUp) {
      ({ promptContent, maxTokens } = buildFollowUpPrompt({
        channel, type, originalMessage, contactLine, firstName, lead, candidateBlock,
      }));
    } else {
      ({ promptContent, maxTokens } = buildDraftPrompt({
        channel, type, lead, companyCtx, candidateBlock, contactLine, firstName,
        hookContext, voiceSection, prefSection, hiringRole, growthSignal,
      }));
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: promptContent }],
    });

    const draft = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    await kv.set(draftKey(user.email, companyId, type, channel), draft, {
      ex: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({ draft, cvMatches, type, channel });
  } catch (err) {
    console.error("bd/draft error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Draft generation failed" },
      { status: 500 }
    );
  }
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildDraftPrompt(opts: {
  channel: Channel; type: DraftType; lead: BDLead;
  companyCtx: string; candidateBlock: string; contactLine: string; firstName: string;
  hookContext: string; voiceSection: string; prefSection: string;
  hiringRole: string; growthSignal: string;
}): { promptContent: string; maxTokens: number } {
  const { channel, type, lead, companyCtx, candidateBlock, contactLine, firstName,
    hookContext, voiceSection, prefSection, hiringRole, growthSignal } = opts;

  if (channel === "email" && type === "candidate") {
    return {
      maxTokens: 500,
      promptContent: `Write a cold outreach email from Éanna (co-founder, Pair People) to the hiring contact at ${lead.companyName}.

COMPANY CONTEXT:
${companyCtx}

Contact: ${contactLine}

${candidateBlock}
${voiceSection}${prefSection}

STRICT RULES — follow every one without exception:

CONFIDENTIALITY: Never use the candidate's name in the email. Refer to them by role, seniority, and employer only. Their identity is not disclosed until the client engages.

1. 150-200 WORDS TOTAL. Count carefully.

2. OPENING — two cases:
   A) IF open role: open with what ${lead.companyName} builds, then reference the specific role.
   B) IF no open role (funding/launch signal): open with what the company builds and the growth signal, position the candidate as relevant to where they're heading. Do NOT imply they're actively hiring.
   Never open with "I saw your job posting" or any generic observation. Lead with the product.

3. CANDIDATE RELEVANCE:
   A) IF open role: connect candidate's skills to the role.
   B) IF no open role: connect candidate's sector experience and tech stack to what the company builds.

4. STRUCTURE:
   - 1 sentence: company + hook
   - 1 sentence: introduce the candidate by role and employer — NO name
   - 2-3 bullet points: candidate's skills relevant to ${lead.companyName}'s stack
   - 1 closing line

5. CANDIDATE INTRO: "I have a [seniority] [role] currently at [Employer]" — never their name. E.g. "I have a Senior ML Engineer currently at Atlassian who'd be a strong fit."

6. BULLET POINTS: candidate's skills and background only. Never Pair People's services.

7. NEVER WRITE: "48-hour turnaround", "pre-vetted", "quality over volume", "boutique", fees, or any agency description.

8. CLOSING LINE: exactly "Any interest in seeing their CV?" or "Worth 15 mins?"

9. SIGN OFF: "Cheers, Éanna" — nothing else.

Return ONLY the email body text. No subject line.`,
    };
  }

  if (channel === "email" && type === "intro") {
    return {
      maxTokens: 500,
      promptContent: `Write a cold outreach email from Éanna (co-founder, Pair People) to the hiring contact at ${lead.companyName}.

This email introduces Pair People — do NOT mention a specific candidate.

COMPANY CONTEXT:
${companyCtx}

Contact: ${contactLine}

ABOUT PAIR PEOPLE (weave in naturally — not a brochure list):
- Sydney-based tech recruitment, specialising in startups and scaleups
- Deep understanding of the AU tech ecosystem and growth-stage hiring challenges
- Fixed fee — not percentage-based, so no incentive to push salaries up
- Network of vetted tech candidates across engineering, data, AI, and product

${voiceSection}${prefSection}

STRICT RULES:

1. 150-200 WORDS TOTAL.

2. OPENING: Lead with what ${lead.companyName} builds + the specific signal (${hookContext || "their recent growth"}). Show you've done the research. Don't open with "I".

3. MIDDLE: One tight sentence on why we're reaching out. Weave in 1-2 Pair People differentiators naturally (especially fixed fee).

4. TONE: Warm and direct, like a peer who follows the space — not a sales pitch.

5. CLOSING: Low-commitment ask — "Worth a quick chat?" or "Open to a conversation?"

6. SIGN OFF: "Cheers, Éanna" — no title, no phone, no website.

Return ONLY the email body text. No subject line.`,
    };
  }

  if (channel === "linkedin" && type === "candidate") {
    return {
      maxTokens: 200,
      promptContent: `Write a LinkedIn InMail from Éanna (co-founder, Pair People) to ${contactLine} at ${lead.companyName}.

COMPANY CONTEXT:
${companyCtx}

${candidateBlock}

RULES:
- 50-80 words TOTAL
- No formal greeting — start directly with the knowledge drop about ${lead.companyName}
- 1 sentence: what ${lead.companyName} builds + the signal/hook
- 1 sentence: the candidate by role and employer only — e.g. "I have a Senior ML Engineer currently at Canva who'd be a great fit for where you're heading."
- Short CTA: "Worth a message back?" or "Happy to send more details?"
- Conversational, peer-to-peer tone — like messaging a colleague, not pitching
- No bullet points
- No formal sign-off (no "Cheers, Éanna") — keep it informal
- CONFIDENTIALITY: never include the candidate's name

Return ONLY the message text.`,
    };
  }

  if (channel === "linkedin" && type === "intro") {
    return {
      maxTokens: 200,
      promptContent: `Write a LinkedIn InMail from Éanna (co-founder, Pair People) to ${contactLine} at ${lead.companyName}.

No candidate to pitch — this is a warm intro to Pair People.

COMPANY CONTEXT:
${companyCtx}

ABOUT PAIR PEOPLE:
- Sydney tech recruitment, startups and scaleups
- Fixed fee (not %) — no incentive to inflate salaries
- Network across engineering, data, AI, product

RULES:
- 50-80 words TOTAL
- No formal greeting — open with the knowledge drop about ${lead.companyName}
- 1 sentence on the company + signal
- 1-2 sentences on Pair People (fixed fee is the key differentiator)
- Short CTA: "Worth a quick chat?"
- Conversational peer tone — no sales language
- No bullet points, no formal sign-off

Return ONLY the message text.`,
    };
  }

  if (channel === "text" && type === "candidate") {
    return {
      maxTokens: 100,
      promptContent: `Write a text message from Éanna (Pair People) to ${firstName} at ${lead.companyName}.

COMPANY CONTEXT:
${companyCtx}

${candidateBlock}

RULES:
- 20-40 words MAX — this is a text message
- Ultra casual, like texting someone you met at a startup event
- Open with "Hey ${firstName}," if it fits
- Reference ${lead.companyName}'s signal or what they build in a single phrase
- Pitch the candidate by role only: "have a great [role] who'd be perfect for where you're heading"
- End with a direct question or CTA
- No bullet points, no sign-off, no formality
- CONFIDENTIALITY: never include the candidate's name

Return ONLY the text message content.`,
    };
  }

  // text + intro
  return {
    maxTokens: 100,
    promptContent: `Write a text message from Éanna (Pair People) to ${firstName} at ${lead.companyName}.

COMPANY CONTEXT:
${companyCtx}

RULES:
- 20-40 words MAX
- Ultra casual — texting a contact you've met before
- Open with "Hey ${firstName},"
- Reference the company's signal or what they build briefly
- One-line Pair People pitch: Sydney tech recruitment, fixed fee, AU startup specialists
- Direct CTA — "keen to chat?"
- No formality, no sign-off

Return ONLY the text message content.`,
  };
}

function buildFollowUpPrompt(opts: {
  channel: Channel; type: DraftType; originalMessage: string;
  contactLine: string; firstName: string; lead: BDLead; candidateBlock: string;
}): { promptContent: string; maxTokens: number } {
  const { channel, type, originalMessage, contactLine, firstName, lead, candidateBlock } = opts;

  const confidentialityNote = type === "candidate"
    ? "\nCONFIDENTIALITY: Never use the candidate's name — role and employer only.\n"
    : "";

  if (channel === "email") {
    return {
      maxTokens: 350,
      promptContent: `Write a follow-up email (75-100 words) from Éanna (co-founder, Pair People) to ${contactLine} at ${lead.companyName}.

Original message sent:
${originalMessage}
${candidateBlock ? `\n${candidateBlock}\n` : ""}${confidentialityNote}
RULES:
1. Open with a natural reference: "Just following up on my note last week..." or similar
2. Add a new angle, different emphasis, or gentle urgency — don't just repeat the original
3. Acknowledge they may be busy — keep the tone warm not pushy
4. Same sign-off: "Cheers, Éanna"
5. 75-100 words total

Return ONLY the email body text. No subject line.`,
    };
  }

  if (channel === "linkedin") {
    return {
      maxTokens: 100,
      promptContent: `Write a LinkedIn follow-up message (20-30 words) from Éanna.

Original message sent:
${originalMessage}
${confidentialityNote}
Write a casual, friendly nudge in the style of: "Hey ${firstName}, just bumping this — [brief one-line reminder of value]. Happy to chat if timing works."
One or two sentences maximum. Very conversational. No formality.

Return ONLY the message text.`,
    };
  }

  // text follow-up
  return {
    maxTokens: 60,
    promptContent: `Write a follow-up text message (10-20 words) from Éanna.

Original text sent:
${originalMessage}
${confidentialityNote}
One line. Friendly nudge. Direct. E.g. "Hey, just checking in on that last message — still keen to chat?"

Return ONLY the text message content.`,
  };
}
