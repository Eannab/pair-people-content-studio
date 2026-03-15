import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { BDLead } from "@/app/api/bd/signals/route";

export async function GET() {
  try {
    const leads = await kv.get<BDLead[]>("bd:leads");
    return NextResponse.json({ leads: leads ?? [] });
  } catch {
    return NextResponse.json({ leads: [] });
  }
}

export async function DELETE() {
  try {
    await kv.del("bd:leads");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
