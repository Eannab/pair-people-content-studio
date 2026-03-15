import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export interface OutreachPreferences {
  toneNotes: string;
  lengthPreference: string;
  structureNotes: string;
  thingsToAvoid: string[];
  rawPreferences: string;
  updatedAt: string;
}

export async function GET() {
  try {
    const prefs = await kv.get<OutreachPreferences>("bd:outreach_preferences");
    return NextResponse.json({ preferences: prefs ?? null });
  } catch {
    return NextResponse.json({ preferences: null });
  }
}

export async function DELETE() {
  try {
    await kv.del("bd:outreach_preferences");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
