import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ImageConcept {
  id: number;
  title: string;
  description: string;
  dallePrompt: string;
}

export async function POST(request: NextRequest) {
  try {
    const { postContent, direction, postType } = await request.json();

    if (!postContent) {
      return NextResponse.json({ error: "Missing postContent" }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: `You are a visual director for Pair People, a Sydney tech recruitment agency. Generate 4 distinct image concept options for a LinkedIn post.

Post type: ${postType || "General"}
Post content: "${postContent.substring(0, 800)}"
${direction ? `Image direction from user: "${direction}"` : "No specific direction — explore what works best."}

Create 4 meaningfully different visual directions (not just variations of the same idea). Consider: abstract/conceptual, literal/scene-based, metaphorical, data/pattern-driven, human-focused, environment-focused.

For each concept write a full DALL-E 3 prompt (80-120 words) that is complete and ready to send directly to DALL-E — specific about style, composition, lighting, colour palette. No text or words in the image. Professional, clean, modern. 1792x1024 wide format.

Return a JSON array of exactly 4 objects:
[
  {
    "id": 1,
    "title": "Short concept title (3-5 words)",
    "description": "1-2 sentences describing what the image would look like and why it fits the post.",
    "dallePrompt": "Full, complete DALL-E 3 prompt ready to use directly."
  }
]

Return ONLY the JSON array — no markdown fences, no preamble.`,
        },
      ],
    });

    const raw =
      response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
    const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    let concepts: ImageConcept[] = [];
    try {
      concepts = JSON.parse(clean);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse concepts from Claude" },
        { status: 500 }
      );
    }

    if (!Array.isArray(concepts) || concepts.length === 0) {
      return NextResponse.json(
        { error: "No concepts returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({ concepts });
  } catch (error) {
    console.error("generate-image/concepts error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Concept generation failed" },
      { status: 500 }
    );
  }
}
