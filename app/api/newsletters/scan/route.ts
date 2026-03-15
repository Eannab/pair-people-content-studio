import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { graphFetch, GraphAuthError } from "@/lib/graph";
import { DEFAULT_SENDERS } from "../senders/route";
import type { NewsletterSender } from "../senders/route";

export interface ScoredArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  receivedDate: string;
  webLink: string;
  topScore: number;
  topSector: "defence" | "ai" | "healthtech" | "sydney" | "general";
  scores: { defence: number; ai: number; healthtech: number; sydney: number };
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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  const truncated = bodyText.substring(0, 2500);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `Extract individual news articles or stories from this newsletter email. Each newsletter may contain multiple articles.

Source: ${email.from.emailAddress.name}
Subject: ${email.subject}
Date: ${email.receivedDateTime.split("T")[0]}

Content:
${truncated}

Return a JSON array. Each item: {"title": "article headline", "summary": "2-3 sentence plain-text summary"}
If this is a single-article newsletter, return it as one item.
Return ONLY the JSON array — no markdown fences, no preamble.`,
      },
    ],
  });

  const raw =
    response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
  const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  let articles: { title: string; summary: string }[] = [];
  try {
    articles = JSON.parse(clean);
  } catch {
    // Extraction failed for this email — skip it
    return [];
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
        content: `Score these ${articles.length} articles 1–10 for relevance to Pair People, a Sydney-based tech recruitment agency.

Score against these four sectors:
- "defence": Defence & Deep Tech (defence tech startups, dual-use technology, deep tech R&D)
- "ai": AI / ML Engineering (AI products, ML infrastructure, LLMs, engineering hiring)
- "healthtech": Healthtech / Medtech (digital health, medical devices, health tech market)
- "sydney": Sydney Startup Market (Sydney ecosystem, local funding, hiring trends, tech sector news)

Articles:
${listText}

Return a JSON array with one object per article (same order as input):
[{
  "topScore": 8,
  "topSector": "ai",
  "scores": {"defence": 2, "ai": 8, "healthtech": 1, "sydney": 5},
  "relevanceSummary": "one sentence on why this is relevant to Pair People"
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
    topSector: string;
    scores: { defence: number; ai: number; healthtech: number; sydney: number };
    relevanceSummary: string;
  }> = [];

  try {
    scored = JSON.parse(clean);
  } catch {
    // Fallback: give every article a neutral score
    scored = articles.map(() => ({
      topScore: 5,
      topSector: "general",
      scores: { defence: 5, ai: 5, healthtech: 5, sydney: 5 },
      relevanceSummary: "",
    }));
  }

  return articles.map((article, i) => ({
    id: `${article.emailId}-${i}`,
    ...article,
    topScore: scored[i]?.topScore ?? 5,
    topSector: (scored[i]?.topSector as ScoredArticle["topSector"]) ?? "general",
    scores: scored[i]?.scores ?? { defence: 5, ai: 5, healthtech: 5, sydney: 5 },
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

    // 4. Filter by approved senders
    const matching = allMessages.filter((m) => matchesSender(m, senders));

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

    // 5. Fetch full body for each matching email (parallel, cap at 10)
    const toProcess = matching.slice(0, 10);
    const bodyResults = await Promise.allSettled(
      toProcess.map((m) => fetchEmailBody(session.accessToken!, m.id))
    );

    // 6. Extract articles from each email (parallel)
    const extractionResults = await Promise.allSettled(
      toProcess.map((msg, i) => {
        const body =
          bodyResults[i].status === "fulfilled"
            ? bodyResults[i].value
            : msg.bodyPreview;
        return extractArticlesFromEmail(msg, body);
      })
    );

    const allExtracted: ExtractedArticle[] = [];
    extractionResults.forEach((r) => {
      if (r.status === "fulfilled") allExtracted.push(...r.value);
    });

    // 7. Score all articles in one Claude call
    const scored = await scoreArticles(allExtracted);

    // Sort by score descending
    scored.sort((a, b) => b.topScore - a.topScore);

    // 8. Persist
    const scannedAt = new Date().toISOString();
    try {
      await kv.set("newsletters:articles", scored, {
        ex: 60 * 60 * 24 * 30, // 30-day TTL
      });
      await kv.set("newsletters:scanned_at", scannedAt);
    } catch {}

    return NextResponse.json({
      articles: scored,
      scannedAt,
      emailsChecked: allMessages.length,
      emailsMatched: matching.length,
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
