import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getVoiceContext } from "@/lib/voice-context";
import { getLinkedInInsightsContext } from "@/lib/linkedin-insights-context";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a LinkedIn ghostwriter for Eanna Barry, co-founder of Pair People, a Sydney-based tech recruitment agency. Write engaging LinkedIn posts that sound authentic, human, and relevant to the Sydney tech and recruitment scene. Pair People's unique value proposition is their Fixed Fee recruitment model. Posts should avoid corporate jargon, be conversational, use line breaks for readability (LinkedIn format), and end with a subtle call to action or thought-provoking question.`;

const postTypePrompts: Record<string, string> = {
  "Hot Candidate":
    "Write a LinkedIn post showcasing an exceptional tech candidate available for hire. Highlight their skills, experience, and what makes them stand out in the market. Don't reveal identifying information — keep it intriguing.",
  "Market Insight":
    "Write a LinkedIn post sharing a data-driven market insight about the Sydney tech hiring market. Make it genuinely useful and share a perspective that adds real value.",
  "Business Journey":
    "Write a LinkedIn post about a lesson learned or milestone in building Pair People. Be authentic, vulnerable where appropriate, and share something genuinely useful.",
  Personal:
    "Write a personal LinkedIn post from Eanna Barry's perspective. Make it genuine, human, and relatable — not a humble brag.",
  "Fixed Fee":
    "Write a LinkedIn post about Pair People's Fixed Fee recruitment model and why it's better for businesses. Explain the value without sounding like a sales pitch.",
  "Live Job":
    "Write a LinkedIn post advertising a tech role that Pair People is recruiting for. Make it engaging and make the role sound compelling — not just a job description.",
};

const angleModifiers: Record<string, string> = {
  Contrarian: "Take a contrarian angle that challenges conventional wisdom.",
  "Data-led": "Lead with data points and statistics to build credibility.",
  "Story-first": "Open with a compelling story or anecdote.",
  "Hot take": "Start with a bold, provocative hot take.",
  "Practical advice": "Structure as practical, actionable advice.",
  "Behind the scenes": "Give an authentic behind-the-scenes perspective.",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postType, angle, context, isRefinement } = body;

    if (!postType || !angle || !context) {
      return NextResponse.json(
        { error: "Missing required fields: postType, angle, context" },
        { status: 400 }
      );
    }

    const basePrompt = isRefinement
      ? `You are refining an existing LinkedIn post. ${angleModifiers[angle] || ""}\n\n${context}`
      : `${postTypePrompts[postType] || `Write a LinkedIn post about: ${postType}.`}\n\n${angleModifiers[angle] || ""}\n\nContext provided by the user:\n${context}\n\nWrite the LinkedIn post now. Output only the post text — no preamble, no explanation, no hashtags unless they're genuinely used on LinkedIn.`;

    const [voiceContext, insightsContext] = await Promise.all([
      getVoiceContext(),
      getLinkedInInsightsContext(postType),
    ]);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT + voiceContext + insightsContext,
      messages: [
        {
          role: "user",
          content: basePrompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    return NextResponse.json({ content: content.text });
  } catch (error) {
    console.error("Generate API error:", error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error. Please try again." },
      { status: 500 }
    );
  }
}
