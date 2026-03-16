import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { dallePrompt } = await request.json();

    if (!dallePrompt) {
      return NextResponse.json({ error: "Missing dallePrompt" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: dallePrompt,
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
      prompt: dallePrompt,
    });
  } catch (error) {
    console.error("generate-image error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed" },
      { status: 500 }
    );
  }
}
