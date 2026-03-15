import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { PipelineLead } from "@/app/api/bd/pipeline/route";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const body = await request.json();
    const { status, notes } = body;

    const pipeline = (await kv.get<PipelineLead[]>("bd:pipeline")) ?? [];
    const idx = pipeline.findIndex((l) => l.id === leadId);
    if (idx === -1) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const updated = { ...pipeline[idx], updatedAt: new Date().toISOString() };
    if (status !== undefined) updated.status = status;
    if (notes !== undefined) updated.notes = notes;

    const updatedPipeline = [...pipeline];
    updatedPipeline[idx] = updated;
    await kv.set("bd:pipeline", updatedPipeline);

    return NextResponse.json({ lead: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const pipeline = (await kv.get<PipelineLead[]>("bd:pipeline")) ?? [];
    const updated = pipeline.filter((l) => l.id !== leadId);
    await kv.set("bd:pipeline", updated);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
