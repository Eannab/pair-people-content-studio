import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import type { BDLead } from "@/app/api/bd/signals/route";
import type { OutreachPreferences } from "@/app/api/bd/preferences/route";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are an outreach email coach for Eanna Barry, co-founder of Pair People, a Sydney-based tech recruitment agency specialising in Defence/DeepTech, AI/ML, Healthtech, and Sydney startup talent.

You are helping refine a cold outreach email to a potential client company.

When the user asks for changes to the email, provide:
1. The full revised email wrapped in <email></email> tags
2. Followed by a brief (1-2 sentence) explanation of what you changed

If the user asks a question, gives feedback, or discusses strategy without requesting a specific change, respond helpfully and concisely — no email needed in that case.

Keep emails direct, warm, and under 120 words. Eanna's tone is confident but not pushy. Never add generic phrases like "I hope this finds you well", "Please don't hesitate to reach out", or "I came across your company".`;

async function maybeUpdatePreferences(
  threadHistory: Message[],
  existingPrefs: OutreachPreferences | null
): Promise<void> {
  const assistantTurns = threadHistory.filter((m) => m.role === "assistant").length;
  if (assistantTurns < 3) return;

  const conversationText = threadHistory
    .map((m) => `${m.role === "user" ? "Eanna" : "AI"}: ${m.content}`)
    .join("\n\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Analyse this outreach email refinement conversation and extract Eanna's preferences for future drafts:

${conversationText}

Return a JSON object:
{
  "toneNotes": "brief note on preferred tone adjustments",
  "lengthPreference": "shorter/longer/current is fine or specific note",
  "structureNotes": "any structural preferences (bullet count, opening style, etc)",
  "thingsToAvoid": ["phrase or approach to avoid", "another thing"],
  "rawPreferences": "2-3 sentence plain text summary for use in future drafts"
}

Return ONLY the JSON — no markdown fences, no preamble.`,
        },
      ],
    });

    const raw =
      response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
    const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const prefs = JSON.parse(clean);

    const updated: OutreachPreferences = {
      toneNotes: prefs.toneNotes ?? existingPrefs?.toneNotes ?? "",
      lengthPreference: prefs.lengthPreference ?? existingPrefs?.lengthPreference ?? "",
      structureNotes: prefs.structureNotes ?? existingPrefs?.structureNotes ?? "",
      thingsToAvoid: prefs.thingsToAvoid ?? existingPrefs?.thingsToAvoid ?? [],
      rawPreferences: prefs.rawPreferences ?? existingPrefs?.rawPreferences ?? "",
      updatedAt: new Date().toISOString(),
    };

    await kv.set("bd:outreach_preferences", updated);
  } catch {
    // Preferences update is non-critical — fail silently
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const history = await kv.get<Message[]>(`bd:thread:${companyId}`);
    return NextResponse.json({ history: history ?? [] });
  } catch {
    return NextResponse.json({ history: [] });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = await request.json();
    const { message, currentDraft } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    // Load thread history
    let history: Message[] = [];
    try {
      history = (await kv.get<Message[]>(`bd:thread:${companyId}`)) ?? [];
    } catch {}

    // Load lead context for the first message
    let leadContext = "";
    if (history.length === 0) {
      try {
        const leads = await kv.get<BDLead[]>("bd:leads");
        const lead = leads?.find((l) => l.id === companyId);
        if (lead) {
          leadContext = `Company: ${lead.companyName} (${lead.sector})\nContact: ${lead.hiringContact.name || "hiring manager"}, ${lead.hiringContact.title || "CTO/Head of Eng"}\n\n`;
        }
      } catch {}
    }

    const newHistory: Message[] = [...history, { role: "user", content: message }];

    // Inject context + current draft into the first message
    const contextPrefix =
      history.length === 0 && currentDraft
        ? `${leadContext}Current email draft:\n\n${currentDraft}\n\n`
        : "";

    const apiMessages: Anthropic.MessageParam[] = newHistory.map((msg, idx) => {
      if (idx === 0 && msg.role === "user") {
        return { role: "user", content: `${contextPrefix}${msg.content}` };
      }
      return { role: msg.role, content: msg.content };
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    });

    const replyText =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";

    const updatedHistory: Message[] = [
      ...newHistory,
      { role: "assistant", content: replyText },
    ];

    // Extract updated draft from <email> tags if present
    const emailMatch = replyText.match(/<email>([\s\S]*?)<\/email>/);
    const updatedDraft = emailMatch ? emailMatch[1].trim() : null;
    const chatReply = replyText.replace(/<email>[\s\S]*?<\/email>/g, "").trim();

    // Persist thread
    try {
      await kv.set(`bd:thread:${companyId}`, updatedHistory, {
        ex: 60 * 60 * 24 * 30,
      });
    } catch {}

    // Update lead's stored draft if we got a revised one
    if (updatedDraft) {
      try {
        const leads = await kv.get<BDLead[]>("bd:leads");
        if (leads) {
          const updatedLeads = leads.map((l) =>
            l.id === companyId
              ? { ...l, outreachDraft: updatedDraft, outreachDraftedAt: new Date().toISOString() }
              : l
          );
          await kv.set("bd:leads", updatedLeads, { ex: 60 * 60 * 24 * 30 });
        }
      } catch {}
    }

    // Update outreach preferences in background after 3+ turns
    const existingPrefs = await kv
      .get<OutreachPreferences>("bd:outreach_preferences")
      .catch(() => null);
    maybeUpdatePreferences(updatedHistory, existingPrefs).catch(() => {});

    return NextResponse.json({
      reply: chatReply || replyText,
      updatedDraft,
      updatedHistory,
    });
  } catch (err) {
    console.error("bd/thread error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Thread error" },
      { status: 500 }
    );
  }
}
