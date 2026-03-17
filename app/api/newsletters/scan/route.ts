import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { graphFetch, GraphAuthError } from "@/lib/graph";
import { detectBDSignals } from "@/lib/bd-signal-detection";
import { DEFAULT_SENDERS } from "../senders/route";
import type { NewsletterSender } from "../senders/route";
import type { BDLead, MarketInsightSignal } from "@/app/api/bd/signals/route";
import { v4 as uuidv4 } from "uuid";

export interface ScoredArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  receivedDate: string;
  webLink: string;
  topScore: number;
  sector: string;
  relevanceSummary: string;
}

interface GraphMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  webLink: string;
}

interface GraphMessageFull extends GraphMessage {
  body: { contentType: string; content: string };
}

interface ExtractedArticle {
  title: string;
  summary: string;
  source: string;
  receivedDate: string;
  webLink: string;
  emailId: string;
}

export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

function matchesSender(msg: GraphMessage, senders: NewsletterSender[]): boolean {
  const fromName = msg.from.emailAddress.name.toLowerCase();
  const fromAddr = msg.from.emailAddress.address.toLowerCase();
  return senders.some(
    (s) =>
      (s.email && fromAddr.includes(s.email.toLowerCase())) ||
      (s.name && fromName.includes(s.name.toLowerCase()))
  );
}

async function fetchEmailBody(
  accessToken: string,
  messageId: string
): Promise<string> {
  const res = await graphFetch(
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=body`,
    accessToken
  );
  if (!res.ok) return "";
  const data: GraphMessageFull = await res.json();
  const raw = data.body?.content ?? "";
  return data.body?.contentType === "html" ? stripHtml(raw) : raw;
}

async function extractArticlesFromEmail(
  email: GraphMessage,
  bodyText: string
): Promise<ExtractedArticle[]> {
  const truncated = bodyText.substring(0, 15000);

  const makeRequest = () => anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: `Extract individual news articles or stories from this newsletter email. Each newsletter may contain multiple articles.

Source: ${email.from.emailAddress.name}
Subject: ${email.subject}
Date: ${email.receivedDateTime.split("T")[0]}

Content:
${truncated}

Extract ALL companies and articles mentioned in the newsletter. Do not stop early. If the newsletter mentions 20 companies, return all 20.
Return a JSON array. Each item: {"title": "article headline", "summary": "2-3 sentence plain-text summary"}
If this is a single-article newsletter, return it as one item.
Return ONLY the JSON array — no markdown fences, no preamble.`,
      },
    ],
  });

  let response;
  try {
    response = await makeRequest();
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 429) {
      console.warn(`[newsletters/scan] 429 on "${email.subject}" — waiting 5s and retrying`);
      await sleep(5000);
      response = await makeRequest();
    } else {
      throw err;
    }
  }

  const raw =
    response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
  const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  let articles: { title: string; summary: string }[] = [];
  try {
    articles = JSON.parse(clean);
  } catch {
    // Response was truncated mid-JSON — salvage complete objects before the break
    const lastClosingBrace = clean.lastIndexOf("}");
    if (lastClosingBrace !== -1) {
      try {
        const salvaged = clean.substring(0, lastClosingBrace + 1) + "]";
        articles = JSON.parse(salvaged);
        console.warn(
          `[newsletters/scan] partial JSON salvaged for "${email.subject}" — got ${articles.length} articles`
        );
      } catch {
        console.warn(
          `[newsletters/scan] JSON parse failed entirely for "${email.subject}" — skipping`
        );
        return [];
      }
    } else {
      console.warn(
        `[newsletters/scan] JSON parse failed entirely for "${email.subject}" — skipping`
      );
      return [];
    }
  }

  return articles
    .filter((a) => a.title?.trim())
    .map((a) => ({
      title: a.title.trim(),
      summary: (a.summary ?? "").trim(),
      source: email.from.emailAddress.name,
      receivedDate: email.receivedDateTime,
      webLink: email.webLink ?? "",
      emailId: email.id,
    }));
}

async function scoreArticles(
  articles: ExtractedArticle[]
): Promise<ScoredArticle[]> {
  if (articles.length === 0) return [];

  const listText = articles
    .map(
      (a, i) =>
        `${i + 1}. "${a.title}" (from ${a.source})\n   ${a.summary}`
    )
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `Score these ${articles.length} articles 1–10 for relevance to Pair People, a Sydney-based tech recruitment agency that places developers, engineers, data scientists, and technical leaders into Australian startups and scaleups.

Score HIGH (7-10) if the article mentions ANY company that:
- Is Australian or expanding into Australia/NZ
- Has or likely needs a tech team
- Is under ~200 employees
- Shows any growth signal: funding, hiring, scaling, launching, expanding, acquiring, partnering

Score LOW (1-3) ONLY if:
- The company is clearly a large enterprise (1000+ employees, ASX100, Fortune 500)
- The company is overseas with zero Australian connection
- The article has no specific company mentioned at all

When in doubt, score HIGH. We would rather see too many leads than miss good ones. If a company is mentioned and it could plausibly be a startup or scaleup with tech needs, give it a 7+.

Articles:
${listText}

For each article return a JSON array (same order as input):
[{
  "topScore": 8,
  "sector": "short label e.g. cleantech, legaltech, fintech, defence, AI, healthtech, saas, logistics, proptech, etc",
  "relevanceSummary": "one sentence on why this company matters to a tech recruiter"
}]

Return ONLY the JSON array — no markdown fences, no preamble.`,
      },
    ],
  });

  const raw =
    response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
  const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  let scored: Array<{
    topScore: number;
    sector: string;
    relevanceSummary: string;
  }> = [];

  try {
    scored = JSON.parse(clean);
  } catch {
    // Fallback: give every article a passing score
    scored = articles.map(() => ({
      topScore: 7,
      sector: "general",
      relevanceSummary: "",
    }));
  }

  return articles.map((article, i) => ({
    id: `${article.emailId}-${i}`,
    ...article,
    topScore: scored[i]?.topScore ?? 7,
    sector: scored[i]?.sector ?? "general",
    relevanceSummary: scored[i]?.relevanceSummary ?? "",
  }));
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function POST() {
  try {
    // 1. Auth
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
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

    // 2. Load senders
    let senders: NewsletterSender[];
    try {
      senders =
        (await kv.get<NewsletterSender[]>("newsletters:senders")) ??
        DEFAULT_SENDERS;
    } catch {
      senders = DEFAULT_SENDERS;
    }

    // 3. Fetch inbox metadata for the last 7 days
    const since = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const params = new URLSearchParams({
      $select: "id,subject,bodyPreview,from,receivedDateTime,webLink",
      $filter: `receivedDateTime ge ${since}`,
      $top: "200",
      $orderby: "receivedDateTime desc",
    });

    const inboxRes = await graphFetch(
      `https://graph.microsoft.com/v1.0/me/messages?${params}`,
      session.accessToken
    );

    if (!inboxRes.ok) {
      const err = await inboxRes.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `Graph API ${inboxRes.status}`);
    }

    const inboxData = await inboxRes.json();
    const allMessages: GraphMessage[] = inboxData.value ?? [];

    // 1. Total emails fetched
    console.log(`[newsletters/scan] fetched ${allMessages.length} emails from Outlook (last 30 days)`);

    // 4. Filter by approved senders
    const matching = allMessages.filter((m) => matchesSender(m, senders));

    // 2. Matched senders
    console.log(`[newsletters/scan] ${matching.length} emails matched approved senders`);
    const matchedSenderNames = [...new Set(matching.map((m) => m.from.emailAddress.name))];
    console.log(`[newsletters/scan] matched sender names: ${matchedSenderNames.join(", ") || "(none)"}`);

    if (matching.length === 0) {
      const scannedAt = new Date().toISOString();
      try {
        await kv.set("newsletters:articles", []);
        await kv.set("newsletters:scanned_at", scannedAt);
      } catch {}
      return NextResponse.json({
        articles: [],
        scannedAt,
        emailsChecked: allMessages.length,
        emailsMatched: 0,
      });
    }

    // 5. Fetch full bodies in parallel (Graph API, not rate-limited like Anthropic)
    const toProcess = matching.slice(0, 30);
    const bodyResults = await Promise.allSettled(
      toProcess.map((m) => fetchEmailBody(session.accessToken!, m.id))
    );

    // 6. Extract articles sequentially to avoid Anthropic 429s
    const allExtracted: ExtractedArticle[] = [];
    for (let i = 0; i < toProcess.length; i++) {
      const msg = toProcess[i];
      const body =
        bodyResults[i].status === "fulfilled"
          ? (bodyResults[i] as PromiseFulfilledResult<string>).value
          : msg.bodyPreview;
      try {
        const articles = await extractArticlesFromEmail(msg, body);
        // 3. Articles extracted per email
        console.log(`[newsletters/scan] "${msg.subject}" → ${articles.length} articles extracted`);
        allExtracted.push(...articles);
      } catch (err) {
        console.warn(`[newsletters/scan] extraction failed for "${msg.subject}":`, err);
      }
      // 1s delay between Haiku calls to stay within rate limits
      if (i < toProcess.length - 1) await sleep(1000);
    }
    console.log(`[newsletters/scan] ${allExtracted.length} total articles extracted across all emails`);

    // 7. Score all articles in one Claude call
    const scored = await scoreArticles(allExtracted);

    // Sort by score descending
    scored.sort((a, b) => b.topScore - a.topScore);

    // 8. Persist articles
    const scannedAt = new Date().toISOString();
    const now = scannedAt;
    try {
      await kv.set("newsletters:articles", scored, {
        ex: 60 * 60 * 24 * 30, // 30-day TTL
      });
      await kv.set("newsletters:scanned_at", scannedAt);
    } catch {}

    // 4. Articles scoring >= 4
    const relevantArticles = scored.filter((a) => a.topScore >= 4);
    console.log(`[newsletters/scan] ${scored.length} articles scored — ${relevantArticles.length} scored >= 4`);

    // 5. Passing to BD signal detection
    console.log(`[newsletters/scan] passing ${relevantArticles.length} articles to detectBDSignals`);

    // 9. BD signal detection on articles scoring >= 4
    let leadsAdded = 0;
    let insightsAdded = 0;

    if (relevantArticles.length > 0) {
      const { bdLeads: detectedLeads, marketInsights: detectedInsights } =
        await detectBDSignals(relevantArticles);

      // Merge BD leads
      let existingLeads: BDLead[] = [];
      try { existingLeads = (await kv.get<BDLead[]>("bd:leads")) ?? []; } catch {}
      const existingLeadNames = new Set(existingLeads.map((l) => l.companyName.toLowerCase()));
      const newLeads = detectedLeads.filter(
        (l) => !existingLeadNames.has(l.companyName.toLowerCase())
      );
      if (newLeads.length > 0) {
        try {
          await kv.set("bd:leads", [...existingLeads, ...newLeads], { ex: 60 * 60 * 24 * 30 });
        } catch {}
        try {
          const existingPipeline =
            (await kv.get<Array<{ id: string; companyName: string }>>("bd:pipeline")) ?? [];
          const pipelineNames = new Set(existingPipeline.map((p) => p.companyName.toLowerCase()));
          const newPipelineEntries = newLeads
            .filter((l) => !pipelineNames.has(l.companyName.toLowerCase()))
            .map((l) => ({
              id: uuidv4(),
              companyId: l.id,
              companyName: l.companyName,
              sector: l.sector,
              signals: l.signals,
              relevanceScore: l.relevanceScore,
              dateAdded: now,
              status: "new" as const,
              notes: "",
              updatedAt: now,
            }));
          if (newPipelineEntries.length > 0) {
            await kv.set("bd:pipeline", [...existingPipeline, ...newPipelineEntries]);
          }
        } catch {}
        leadsAdded = newLeads.length;
      }

      // Merge market insights
      let existingInsights: MarketInsightSignal[] = [];
      try { existingInsights = (await kv.get<MarketInsightSignal[]>("bd:market_insights")) ?? []; } catch {}
      const existingInsightNames = new Set(existingInsights.map((i) => i.companyName.toLowerCase()));
      const newInsights = detectedInsights.filter(
        (i) => !existingInsightNames.has(i.companyName.toLowerCase())
      );
      if (newInsights.length > 0) {
        try {
          await kv.set("bd:market_insights", [...existingInsights, ...newInsights], {
            ex: 60 * 60 * 24 * 30,
          });
        } catch {}
        insightsAdded = newInsights.length;
      }
    }

    return NextResponse.json({
      articles: scored,
      scannedAt,
      emailsChecked: allMessages.length,
      emailsMatched: matching.length,
      leadsAdded,
      insightsAdded,
    });
  } catch (err) {
    console.error("newsletters/scan error:", err);
    if (err instanceof GraphAuthError) {
      return NextResponse.json(
        { error: "Microsoft session expired. Please reconnect.", tokenExpired: true },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scan failed" },
      { status: 500 }
    );
  }
}

// GET — return cached articles
export async function GET() {
  try {
    const [articles, scannedAt] = await Promise.all([
      kv.get<ScoredArticle[]>("newsletters:articles"),
      kv.get<string>("newsletters:scanned_at"),
    ]);
    return NextResponse.json({ articles: articles ?? [], scannedAt: scannedAt ?? null });
  } catch {
    return NextResponse.json({ articles: [], scannedAt: null });
  }
}
