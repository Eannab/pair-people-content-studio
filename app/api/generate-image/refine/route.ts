import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { currentPrompt, instruction } = await request.json();

    if (!currentPrompt || !instruction) {
      return NextResponse.json(
        { error: "Missing currentPrompt or instruction" },
        { status: 400 }
      );
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `You are a DALL-E 3 prompt engineer. Take the existing DALL-E 3 prompt and apply the user's refinement instruction to produce an improved prompt.

Existing prompt:
"${currentPrompt}"

Refinement instruction:
"${instruction}"

Return ONLY the updated DALL-E 3 prompt text — no preamble, no quotes, no explanation. Keep it 80-120 words. Maintain the same professional, clean, modern style. No text or words in the image. 1792x1024 wide format.`,
        },
      ],
    });

    const refinedPrompt =
      response.content[0].type === "text" ? response.content[0].text.trim() : currentPrompt;

    return NextResponse.json({ refinedPrompt });
  } catch (error) {
    console.error("generate-image/refine error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Refinement failed" },
      { status: 500 }
    );
  }
}
