import { NextRequest, NextResponse } from "next/server";
import { updatePipelineLead, deletePipelineLead } from "@/lib/pipeline-kv";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const body = await request.json();
    const { status, notes } = body;

    const updated = await updatePipelineLead(leadId, {
      ...(status !== undefined && { status }),
      ...(notes !== undefined && { notes }),
    });

    if (!updated) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

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
    await deletePipelineLead(leadId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
