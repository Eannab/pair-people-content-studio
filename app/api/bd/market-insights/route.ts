import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { MarketInsightSignal } from "@/app/api/bd/signals/route";

export async function GET() {
  try {
    const insights = await kv.get<MarketInsightSignal[]>("bd:market_insights");
    return NextResponse.json({ insights: insights ?? [] });
  } catch {
    return NextResponse.json({ insights: [] });
  }
}
