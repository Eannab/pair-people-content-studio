import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { CompanySignal } from "@/app/api/bd/signals/route";

export interface PipelineLead {
  id: string;
  companyId?: string; // links to current bd:leads entry
  companyName: string;
  sector: "defence" | "ai" | "healthtech" | "sydney" | "general";
  signals: CompanySignal[];
  relevanceScore: number;
  dateAdded: string;
  status: "new" | "contacted" | "replied" | "converted" | "dismissed";
  notes: string;
  updatedAt: string;
}

export async function GET() {
  try {
    const pipeline = await kv.get<PipelineLead[]>("bd:pipeline");
    return NextResponse.json({ pipeline: pipeline ?? [] });
  } catch {
    return NextResponse.json({ pipeline: [] });
  }
}

// Upsert multiple leads into the pipeline (used by signals + manual routes)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const incoming: PipelineLead[] = body.leads ?? [];
    if (incoming.length === 0) {
      const existing = await kv.get<PipelineLead[]>("bd:pipeline") ?? [];
      return NextResponse.json({ pipeline: existing, added: 0 });
    }

    const existing = (await kv.get<PipelineLead[]>("bd:pipeline")) ?? [];
    const existingNames = new Set(existing.map((l) => l.companyName.toLowerCase()));
    const toAdd = incoming.filter((l) => !existingNames.has(l.companyName.toLowerCase()));

    if (toAdd.length === 0) {
      return NextResponse.json({ pipeline: existing, added: 0 });
    }

    const updated = [...existing, ...toAdd];
    await kv.set("bd:pipeline", updated);
    return NextResponse.json({ pipeline: updated, added: toAdd.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pipeline update failed" },
      { status: 500 }
    );
  }
}
