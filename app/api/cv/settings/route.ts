import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export interface CVSettings {
  folderPath: string; // e.g. "/Active CVs"
  updatedAt: string;
}

export async function GET() {
  try {
    const settings = await kv.get<CVSettings>("cv:settings");
    return NextResponse.json(settings ?? { folderPath: "", updatedAt: "" });
  } catch (err) {
    console.error("cv/settings GET error:", err);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { folderPath } = await request.json();
    if (typeof folderPath !== "string") {
      return NextResponse.json({ error: "folderPath required" }, { status: 400 });
    }
    const settings: CVSettings = { folderPath: folderPath.trim(), updatedAt: new Date().toISOString() };
    await kv.set("cv:settings", settings);
    return NextResponse.json(settings);
  } catch (err) {
    console.error("cv/settings POST error:", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
