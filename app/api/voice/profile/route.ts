import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import { getSessionUser, uk, unauthorized } from "@/lib/user-key";
import type { LinkedInPost } from "../upload/route";

export interface VoiceProfile {
  writingStyle: string;
  tone: string;
  vocabulary: string[];
  averageLength: number;
  typicalStructure: string;
  topicsCovered: string[];
  topicsAvoided: string[];
  keyPhrases: string[];
  hookPatterns: string[];
  summary: string;
  generatedAt: string;
  postCount: number;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET — return stored profile (and post count) for the authenticated user
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  try {
    const [profile, posts] = await Promise.all([
      kv.get<VoiceProfile>(uk(user.email, "linkedin:voice_profile")),
      kv.get<LinkedInPost[]>(uk(user.email, "linkedin:posts")),
    ]);
    return NextResponse.json({
      profile: profile ?? null,
      postCount: posts?.length ?? 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load profile" },
      { status: 500 }
    );
  }
}

// POST — (re)generate voice profile from stored posts for the authenticated user
export async function POST() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  try {
    const posts = await kv.get<LinkedInPost[]>(uk(user.email, "linkedin:posts"));
    if (!posts || posts.length === 0) {
      return NextResponse.json(
        { error: "No posts found. Please upload your LinkedIn CSV first." },
        { status: 400 }
      );
    }

    const sample = posts.slice(0, 20);
    const postsBlock = sample
      .map(
        (p, i) =>
          `--- Post ${i + 1}${p.date ? ` (${p.date.split(" ")[0]})` : ""} ---\n${p.text}`
      )
      .join("\n\n");

    const avgLen = Math.round(
      posts.slice(0, 50).reduce((s, p) => s + p.text.length, 0) /
        Math.min(posts.length, 50)
    );

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `You are analysing LinkedIn posts by ${user.name}, co-founder of Pair People (Sydney-based tech recruitment agency). Based on the ${sample.length} posts below, produce a voice profile as a JSON object.

Posts (most recent first):
${postsBlock}

Respond with ONLY a JSON object matching this exact structure — no markdown, no preamble:
{
  "writingStyle": "2–3 sentences describing their writing style",
  "tone": "2–3 sentences describing tone and register",
  "vocabulary": ["characteristic word or phrase", ...],
  "averageLength": ${avgLen},
  "typicalStructure": "describe the typical post structure in one sentence",
  "topicsCovered": ["topic", ...],
  "topicsAvoided": ["topic", ...],
  "keyPhrases": ["recurring phrase", ...],
  "hookPatterns": ["opening hook style", ...],
  "summary": "2–3 paragraphs capturing ${user.name}'s LinkedIn voice that can be injected into a writing prompt to make AI-generated posts match their style"
}`,
        },
      ],
    });

    const raw =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let parsed: Omit<VoiceProfile, "generatedAt" | "postCount">;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: "Claude returned an unexpected format. Please try again." },
        { status: 500 }
      );
    }

    const profile: VoiceProfile = {
      ...parsed,
      averageLength: avgLen,
      generatedAt: new Date().toISOString(),
      postCount: posts.length,
    };

    await kv.set(uk(user.email, "linkedin:voice_profile"), profile);

    return NextResponse.json({ profile });
  } catch (err) {
    console.error("voice/profile POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Profile generation failed" },
      { status: 500 }
    );
  }
}
