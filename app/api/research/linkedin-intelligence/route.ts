import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import { v4 as uuidv4 } from "uuid";
import type { LinkedInInsight, LinkedInIntelligenceReport } from "@/lib/linkedin-insights-context";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SEARCH_QUERIES = [
  // Group 1 — boutique tech recruitment founders (US/UK)
  "linkedin post from boutique tech recruitment founder 2025",
  "tech recruiter founder linkedin viral post hiring insights",
  // Group 2 — non-recruitment tech founders
  "startup founder linkedin post engineering team scaling 2025",
  "tech founder linkedin post product launch growth lessons",
  // Group 3 — AU startup founders
  "australia startup founder linkedin post 2025 sydney",
  "australian tech entrepreneur linkedin post funding hiring",
];

async function braveSearch(query: string): Promise<string> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return "";

  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
      }
    );
    if (!res.ok) return "";
    const data = await res.json();
    const results = (data.web?.results ?? []) as Array<{
      title: string;
      description: string;
      url: string;
    }>;
    return results
      .map((r) => `${r.title}: ${r.description}`)
      .join("\n");
  } catch {
    return "";
  }
}

// GET — return latest report
export async function GET() {
  try {
    const report = await kv.get<LinkedInIntelligenceReport>("research:linkedin_intelligence");
    return NextResponse.json(report ?? null);
  } catch (err) {
    console.error("linkedin-intelligence GET error:", err);
    return NextResponse.json({ error: "Failed to load report" }, { status: 500 });
  }
}

// POST — generate a new report
export async function POST() {
  try {
    // Run searches in parallel
    const searchResults = await Promise.all(SEARCH_QUERIES.map(braveSearch));
    const combinedSearch = searchResults.filter(Boolean).join("\n\n---\n\n");

    const now = new Date();
    const monthYear = now.toLocaleString("en-AU", { month: "long", year: "numeric" });

    const researchContext = combinedSearch
      ? `Web research findings:\n${combinedSearch.substring(0, 8000)}`
      : "Note: No live search results available. Use your knowledge of LinkedIn content trends.";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: `You are a LinkedIn content strategist analysing what's working for tech and recruitment founders.

Analyse the following research findings to extract actionable insights about high-performing LinkedIn post patterns.
Focus on three groups:
1. Boutique tech recruitment founders (US/UK) — e.g. accounts with 5k-50k followers
2. Non-recruitment tech founders with high engagement
3. Australian startup founders

${researchContext}

Generate 5-8 specific, actionable insights about what's working RIGHT NOW. Each insight should be concrete and usable.

Return JSON:
{
  "insights": [
    {
      "id": "uuid",
      "title": "Short title (5-8 words)",
      "observation": "What pattern is working and why (2-3 sentences)",
      "examplePost": "Example post opening or key lines (truncated, max 200 chars)",
      "exampleAuthor": "Type of account (e.g. 'UK boutique recruiter, 12k followers') — never use real names",
      "applicablePostTypes": ["Market Insight", "Business Journey"],
      "group": "boutique_recruitment"
    }
  ]
}

applicablePostTypes — use these exact values (or empty array for all): "Hot Candidate", "Market Insight", "Business Journey", "Personal", "Fixed Fee", "Live Job"
group: "boutique_recruitment" | "non_recruitment_tech" | "au_startup"

Return ONLY the JSON object.`,
        },
      ],
    });

    const raw =
      response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
    const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let parsed: { insights: Partial<LinkedInInsight>[] } = { insights: [] };
    try {
      parsed = JSON.parse(clean);
    } catch {
      parsed = { insights: [] };
    }

    const insights: LinkedInInsight[] = (parsed.insights ?? []).map((i) => ({
      id: i.id ?? uuidv4(),
      title: i.title ?? "Untitled insight",
      observation: i.observation ?? "",
      examplePost: i.examplePost ?? "",
      exampleAuthor: i.exampleAuthor ?? "",
      applicablePostTypes: i.applicablePostTypes ?? [],
      group: i.group ?? "non_recruitment_tech",
      generatedAt: now.toISOString(),
    }));

    const report: LinkedInIntelligenceReport = {
      insights,
      generatedAt: now.toISOString(),
      coversPeriod: monthYear,
    };

    await kv.set("research:linkedin_intelligence", report, { ex: 60 * 60 * 24 * 45 });

    return NextResponse.json(report);
  } catch (err) {
    console.error("linkedin-intelligence POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Report generation failed" },
      { status: 500 }
    );
  }
}
