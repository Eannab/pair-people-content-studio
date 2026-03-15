import { NextRequest, NextResponse } from "next/server";
import type { CompanySignal } from "@/app/api/bd/signals/route";
import {
  getPipelineAll,
  upsertPipelineLeads,
} from "@/lib/pipeline-kv";

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
    const pipeline = await getPipelineAll();
    return NextResponse.json({ pipeline });
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
      const existing = await getPipelineAll();
      return NextResponse.json({ pipeline: existing, added: 0 });
    }

    const { added } = await upsertPipelineLeads(incoming);
    const pipeline = await getPipelineAll();
    return NextResponse.json({ pipeline, added });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pipeline update failed" },
      { status: 500 }
    );
  }
}
