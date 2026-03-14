import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import type { LinkedInPost } from "../upload/route";

export interface PostAssessment {
  text: string;
  date: string;
  tier: "A" | "B" | "C";
  tierReason: string;
  hook: string;
  inferredType: string;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET — return cached assessments
export async function GET() {
  try {
    const assessments = await kv.get<PostAssessment[]>("linkedin:assessments");
    return NextResponse.json({ assessments: assessments ?? null });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load assessments" },
      { status: 500 }
    );
  }
}

// POST — run fresh assessment on stored posts (up to 30)
export async function POST() {
  try {
    const posts = await kv.get<LinkedInPost[]>("linkedin:posts");
    if (!posts || posts.length === 0) {
      return NextResponse.json(
        { error: "No posts found. Please upload your LinkedIn CSV first." },
        { status: 400 }
      );
    }

    const sample = posts.slice(0, 30);

    const postsBlock = sample
      .map(
        (p, i) =>
          `--- Post ${i + 1}${p.date ? ` (${p.date.split(" ")[0]})` : ""} ---\n${p.text.substring(0, 300)}${p.text.length > 300 ? "…" : ""}`
      )
      .join("\n\n");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `Assess these ${sample.length} LinkedIn posts by Eanna Barry (co-founder of Pair People, a Sydney tech recruitment agency). Return a JSON array with one object per post in the same order.

Each object must have:
- "tier": "A" | "B" | "C"   (A = excellent hook + high engagement potential, B = solid and clear value, C = average or generic)
- "tierReason": one concise sentence explaining the tier
- "hook": the exact opening sentence or phrase that grabs attention
- "inferredType": one of ["Hot Candidate","Market Insight","Business Journey","Personal","Fixed Fee","Live Job","Other"]

${postsBlock}

Respond with ONLY the JSON array — no markdown fences, no preamble.`,
        },
      ],
    });

    const raw =
      message.content[0].type === "text" ? message.content[0].text.trim() : "[]";

    const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let tiers: Array<{
      tier: "A" | "B" | "C";
      tierReason: string;
      hook: string;
      inferredType: string;
    }>;

    try {
      tiers = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: "Assessment returned an unexpected format. Please try again." },
        { status: 500 }
      );
    }

    const assessments: PostAssessment[] = sample.map((p, i) => ({
      text: p.text,
      date: p.date,
      tier: tiers[i]?.tier ?? "C",
      tierReason: tiers[i]?.tierReason ?? "",
      hook: tiers[i]?.hook ?? p.text.split(/[.!?\n]/)[0] ?? "",
      inferredType: tiers[i]?.inferredType ?? "Other",
    }));

    await kv.set("linkedin:assessments", assessments);

    return NextResponse.json({ assessments });
  } catch (err) {
    console.error("voice/assess POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Assessment failed" },
      { status: 500 }
    );
  }
}
