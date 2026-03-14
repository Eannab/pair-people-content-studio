import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { postContent, direction, postType } = await request.json();

    if (!postContent) {
      return NextResponse.json({ error: "Missing postContent" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Step 1: Use Claude to craft a DALL-E prompt from the post content
    const promptMessage = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `You are writing a DALL-E 3 image prompt for a LinkedIn post from Pair People, a Sydney-based tech recruitment agency.

Post type: ${postType || "General"}
Post content: "${postContent.substring(0, 800)}"
${direction ? `Image direction from user: "${direction}"` : ""}

Write a concise DALL-E 3 prompt (max 120 words) for a wide-format professional image that complements this post. Focus on mood, composition, and visual metaphors relevant to tech and recruitment in Sydney. The style should be clean, modern, and corporate but human. No text or words in the image. Output only the prompt text — no preamble, no explanation.`,
        },
      ],
    });

    const imagePrompt =
      promptMessage.content[0].type === "text"
        ? promptMessage.content[0].text.trim()
        : "Professional office environment with modern technology, clean minimal style";

    // Step 2: Call DALL-E 3 with the generated prompt
    const openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: imagePrompt,
        n: 1,
        size: "1792x1024",
        response_format: "b64_json",
      }),
    });

    if (!openaiRes.ok) {
      const errData = await openaiRes.json().catch(() => ({}));
      throw new Error(
        errData?.error?.message || `OpenAI API error: ${openaiRes.status}`
      );
    }

    const openaiData = await openaiRes.json();
    const b64 = openaiData.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image data in OpenAI response");

    return NextResponse.json({
      imageUrl: `data:image/png;base64,${b64}`,
      prompt: imagePrompt,
    });
  } catch (error) {
    console.error("generate-image error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed" },
      { status: 500 }
    );
  }
}
