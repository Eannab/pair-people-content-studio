import { NextRequest, NextResponse } from "next/server";
import { getTopCVMatches } from "@/lib/cv-context";
import type { BDLead } from "@/app/api/bd/signals/route";

export async function POST(request: NextRequest) {
  try {
    const lead = await request.json() as BDLead;
    if (!lead?.id) {
      return NextResponse.json({ error: "Lead object required" }, { status: 400 });
    }
    const matches = await getTopCVMatches(lead);
    return NextResponse.json({ matches });
  } catch (err) {
    console.error("cv/match error:", err);
    return NextResponse.json({ error: "CV match failed" }, { status: 500 });
  }
}
