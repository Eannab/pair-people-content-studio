import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { graphFetch, GraphAuthError } from "@/lib/graph";
import { uk } from "@/lib/user-key";

export interface OutreachVoiceProfile {
  emailsAnalysed: number;
  repliesDetected: number;
  responseRate: string;
  openingStyle: string;
  candidateDescriptionStyle: string;
  companyDescriptionStyle: string;
  typicalStructure: string;
  typicalLength: string;
  tone: string;
  ctaStyle: string;
  topPerformingPatterns: string[];
  lowPerformingPatterns: string[];
  distinctivePhrases: string[];
  generatedAt: string;
}

interface GraphSentMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  toRecipients: Array<{ emailAddress: { name: string; address: string } }>;
  sentDateTime: string;
  conversationId: string;
}

interface GraphMessageBody {
  body: { contentType: string; content: string };
}

interface GraphInboxMessage {
  id: string;
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  conversationId: string;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Redacts known PII from an email body before sending to Claude.
 * Handles: email addresses, phone numbers, recipient name, company domain.
 */
function redactPII(
  body: string,
  recipientName: string,
  recipientEmail: string
): string {
  let redacted = body;

  // Email addresses
  redacted = redacted.replace(
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    "[EMAIL]"
  );

  // Phone numbers (international and local formats)
  redacted = redacted.replace(
    /(\+?1?\s*[\-(.]?\d{3}[\-).]\s?\d{3}[\s\-.]?\d{4}|\+\d{1,3}\s?\d{6,14})/g,
    "[PHONE]"
  );

  // Recipient name parts (first, last, full)
  if (recipientName?.trim()) {
    const nameParts = recipientName
      .split(/\s+/)
      .filter((p) => p.length > 2)
      .concat([recipientName]);
    for (const part of nameParts) {
      try {
        const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        redacted = redacted.replace(new RegExp(escaped, "gi"), "[NAME]");
      } catch {
        // skip malformed parts
      }
    }
  }

  // Company name from recipient email domain (e.g. "atlassian" from john@atlassian.com)
  if (recipientEmail) {
    const domainPart = recipientEmail.split("@")[1]?.split(".")[0];
    if (domainPart && domainPart.length > 2) {
      try {
        const escaped = domainPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        redacted = redacted.replace(new RegExp(escaped, "gi"), "[COMPANY]");
      } catch {
        // skip
      }
    }
  }

  return redacted;
}

async function fetchMessageBody(
  accessToken: string,
  messageId: string
): Promise<string> {
  const res = await graphFetch(
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=body`,
    accessToken
  );
  if (!res.ok) return "";
  const data: GraphMessageBody = await res.json();
  const raw = data.body?.content ?? "";
  return data.body?.contentType === "html" ? stripHtml(raw) : raw;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const profile = await kv.get<OutreachVoiceProfile>(
      uk(session.user.email, "outreach:voice_profile")
    );
    return NextResponse.json({ profile: profile ?? null });
  } catch {
    return NextResponse.json({ profile: null });
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken || !session?.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated. Please connect your Outlook account." },
        { status: 401 }
      );
    }
    if (session.error === "RefreshAccessTokenError") {
      return NextResponse.json(
        { error: "Microsoft session expired. Please reconnect.", tokenExpired: true },
        { status: 401 }
      );
    }

    const userEmail = session.user.email.toLowerCase();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Fetch sent items metadata from the last 30 days
    const sentParams = new URLSearchParams({
      $select: "id,subject,toRecipients,sentDateTime,conversationId,bodyPreview",
      $filter: `sentDateTime ge ${since}`,
      $top: "100",
      $orderby: "sentDateTime desc",
    });

    const sentRes = await graphFetch(
      `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?${sentParams}`,
      session.accessToken
    );
    if (!sentRes.ok) {
      const err = await sentRes.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `Graph API ${sentRes.status}`);
    }

    const sentData = await sentRes.json();
    const sentMessages: GraphSentMessage[] = sentData.value ?? [];

    // 2. Filter to likely outreach: not a reply/forward, single recipient
    const candidates = sentMessages.filter((m) => {
      const subj = (m.subject ?? "").toLowerCase().trim();
      if (
        subj.startsWith("re:") ||
        subj.startsWith("fw:") ||
        subj.startsWith("fwd:")
      )
        return false;
      if (!m.toRecipients || m.toRecipients.length !== 1) return false;
      return true;
    });

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          error:
            "No qualifying outreach emails found in sent items from the last 30 days.",
          emailsScanned: sentMessages.length,
        },
        { status: 422 }
      );
    }

    // 3. Fetch full bodies for up to 40 candidates (parallel)
    const toProcess = candidates.slice(0, 40);
    const bodyResults = await Promise.allSettled(
      toProcess.map((m) => fetchMessageBody(session.accessToken!, m.id))
    );

    // 4. Keep emails under 300 words
    const outreachEmails: Array<{
      msg: GraphSentMessage;
      body: string;
      wordCount: number;
    }> = [];

    for (let i = 0; i < toProcess.length; i++) {
      if (bodyResults[i].status !== "fulfilled") continue;
      const body = (bodyResults[i] as PromiseFulfilledResult<string>).value;
      const wordCount = countWords(body);
      if (wordCount >= 10 && wordCount < 300) {
        outreachEmails.push({ msg: toProcess[i], body, wordCount });
      }
    }

    if (outreachEmails.length < 3) {
      return NextResponse.json(
        {
          error:
            "Not enough qualifying outreach emails found. Need at least 3 emails under 300 words sent to individual recipients.",
          emailsScanned: sentMessages.length,
          candidatesFound: candidates.length,
        },
        { status: 422 }
      );
    }

    // 5. Fetch inbox messages to detect replies (non-fatal if it fails)
    const inboxParams = new URLSearchParams({
      $select: "id,from,receivedDateTime,conversationId",
      $filter: `receivedDateTime ge ${since}`,
      $top: "500",
    });

    let inboxMessages: GraphInboxMessage[] = [];
    try {
      const inboxRes = await graphFetch(
        `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?${inboxParams}`,
        session.accessToken
      );
      if (inboxRes.ok) {
        const inboxData = await inboxRes.json();
        inboxMessages = inboxData.value ?? [];
      }
    } catch {
      // Proceed without reply detection
    }

    // Build set of conversationIds where someone replied (not from the user themselves)
    const repliedConversationIds = new Set<string>();
    for (const msg of inboxMessages) {
      if (msg.from?.emailAddress?.address?.toLowerCase() !== userEmail) {
        repliedConversationIds.add(msg.conversationId);
      }
    }

    // 6. Redact PII and annotate with reply status
    const annotated = outreachEmails.map(({ msg, body, wordCount }) => {
      const recipient = msg.toRecipients[0]?.emailAddress ?? {
        name: "",
        address: "",
      };
      const redacted = redactPII(body, recipient.name, recipient.address);
      const gotReply = repliedConversationIds.has(msg.conversationId);
      return { redacted, gotReply, wordCount };
    });

    const withReply = annotated.filter((e) => e.gotReply);
    const withoutReply = annotated.filter((e) => !e.gotReply);

    // 7. Build analysis prompt with all redacted emails
    const emailsText = annotated
      .map(
        (e, i) =>
          `--- Email ${i + 1} (${e.wordCount} words, ${
            e.gotReply ? "GOT REPLY ✓" : "no reply"
          }) ---\n${e.redacted}`
      )
      .join("\n\n");

    const analysisResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Analyse these ${annotated.length} cold outreach emails from a tech recruiter. All names, companies, and contact details have been redacted. ${withReply.length} emails got replies, ${withoutReply.length} did not.

Your task: build a detailed outreach voice profile. Focus on HOW the author writes — style, structure, language patterns — not who they contacted.

${emailsText}

Return a JSON object with exactly these fields:
{
  "openingStyle": "1-2 sentences: how the author opens cold emails — what they lead with, their hook approach",
  "candidateDescriptionStyle": "how they describe candidates without naming them — specific phrases and patterns used (e.g. 'one of the best healthtech engineers in Australia', 'immediately available')",
  "companyDescriptionStyle": "how they describe the target company or role they're pitching to",
  "typicalStructure": "the email structure in order — e.g. 'Research hook → recruit intro → 3 value bullets → soft CTA'",
  "typicalLength": "estimated word range based on samples, e.g. '80-120 words'",
  "tone": "2-4 word tone descriptor, e.g. 'direct, warm, confident'",
  "ctaStyle": "how they close the email and phrase the call to action",
  "topPerformingPatterns": ["specific pattern from emails that GOT replies — be concrete", "pattern 2", "pattern 3 — if <3 replies, note 'limited data'"],
  "lowPerformingPatterns": ["pattern from emails that did NOT get replies", "pattern 2"],
  "distinctivePhrases": ["a recurring phrase or structural habit", "phrase 2", "phrase 3", "phrase 4", "phrase 5"]
}

If fewer than 3 emails got replies, set topPerformingPatterns to general observations about the strongest emails and note "(limited reply data)".
Return ONLY the JSON object — no markdown fences, no preamble.`,
        },
      ],
    });

    const raw =
      analysisResponse.content[0].type === "text"
        ? analysisResponse.content[0].text.trim()
        : "{}";
    const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let analysis: Omit<
      OutreachVoiceProfile,
      "emailsAnalysed" | "repliesDetected" | "responseRate" | "generatedAt"
    >;
    try {
      analysis = JSON.parse(clean);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse analysis from Claude" },
        { status: 500 }
      );
    }

    const responseRatePct =
      annotated.length > 0
        ? Math.round((withReply.length / annotated.length) * 100)
        : 0;

    const profile: OutreachVoiceProfile = {
      ...analysis,
      emailsAnalysed: annotated.length,
      repliesDetected: withReply.length,
      responseRate: `${responseRatePct}% (${withReply.length} of ${annotated.length} emails got a reply)`,
      generatedAt: new Date().toISOString(),
    };

    // 8. Store in KV (no expiry — persists until refreshed)
    await kv.set(uk(session.user.email, "outreach:voice_profile"), profile);

    return NextResponse.json({ profile, emailsScanned: sentMessages.length });
  } catch (err) {
    console.error("voice/outreach error:", err);
    if (err instanceof GraphAuthError) {
      return NextResponse.json(
        {
          error: "Microsoft session expired. Please reconnect.",
          tokenExpired: true,
        },
        { status: 401 }
      );
    }
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Outreach analysis failed",
      },
      { status: 500 }
    );
  }
}
