import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getSessionUser, uk, unauthorized } from "@/lib/user-key";

export interface OutreachPreferences {
  toneNotes: string;
  lengthPreference: string;
  structureNotes: string;
  thingsToAvoid: string[];
  rawPreferences: string;
  updatedAt: string;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  try {
    const prefs = await kv.get<OutreachPreferences>(uk(user.email, "bd:outreach_preferences"));
    return NextResponse.json({ preferences: prefs ?? null });
  } catch {
    return NextResponse.json({ preferences: null });
  }
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  try {
    await kv.del(uk(user.email, "bd:outreach_preferences"));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
