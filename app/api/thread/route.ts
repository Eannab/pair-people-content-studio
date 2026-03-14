import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import { getVoiceContext } from "@/lib/voice-context";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a LinkedIn ghostwriter for Eanna Barry, co-founder of Pair People, a Sydney-based tech recruitment agency. You are in a multi-turn conversation helping refine a LinkedIn post.

When the user asks for changes or improvements, provide the full revised post. When the user asks questions, answer them helpfully. Keep responses focused on improving the post and making it as effective as possible for LinkedIn engagement in the Sydney tech space.

If you're providing a revised post, output only the post text. If you're answering a question or providing feedback, keep it concise and practical.`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postId, message, conversationHistory, currentPost, postType, angle } = body;

    if (!postId || !message) {
      return NextResponse.json(
        { error: "Missing required fields: postId, message" },
        { status: 400 }
      );
    }

    // Try to load existing history from KV, fall back to provided history
    let history: Message[] = conversationHistory || [];

    try {
      const storedHistory = await kv.get<Message[]>(`thread:${postId}`);
      if (storedHistory && storedHistory.length > 0) {
        history = storedHistory;
      }
    } catch (kvError) {
      // KV not configured — use in-memory history from client
      console.warn("Vercel KV not available, using client-provided history:", kvError);
    }

    // Ensure the new user message is in history
    const lastMessage = history[history.length - 1];
    const newHistory: Message[] =
      lastMessage?.role === "user" && lastMessage?.content === message
        ? history
        : [...history, { role: "user", content: message }];

    // Build context message for Claude
    const contextPrefix = currentPost
      ? `The current version of the LinkedIn post being refined:\n\n---\n${currentPost}\n---\n\nPost type: ${postType || "General"}\nAngle: ${angle || "General"}\n\n`
      : "";

    // Prepare messages for the API — inject context into the first user message
    const apiMessages: Anthropic.MessageParam[] = newHistory.map((msg, idx) => {
      if (idx === 0 && msg.role === "user") {
        return {
          role: "user",
          content: `${contextPrefix}${msg.content}`,
        };
      }
      return { role: msg.role, content: msg.content };
    });

    const voiceContext = await getVoiceContext();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT + voiceContext,
      messages: apiMessages,
    });

    const replyContent = response.content[0];
    if (replyContent.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const reply = replyContent.text;
    const updatedHistory: Message[] = [
      ...newHistory,
      { role: "assistant", content: reply },
    ];

    // Persist to KV (if available)
    try {
      await kv.set(`thread:${postId}`, updatedHistory, { ex: 60 * 60 * 24 * 7 }); // 7 days TTL
    } catch (kvError) {
      console.warn("Could not persist thread to KV:", kvError);
    }

    return NextResponse.json({ reply, updatedHistory });
  } catch (error) {
    console.error("Thread API error:", error);

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
