import { NextRequest, NextResponse } from "next/server";

// Vercel cron handler — runs on "0 0 1 * *" (1st of each month at midnight UTC)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? "https://localhost:3000";
    const res = await fetch(`${baseUrl}/api/research/linkedin-intelligence`, {
      method: "POST",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: "Report generation failed", details: err }, { status: 502 });
    }

    const report = await res.json();
    return NextResponse.json({
      ok: true,
      insightsGenerated: report.insights?.length ?? 0,
      generatedAt: report.generatedAt,
    });
  } catch (err) {
    console.error("linkedin-intelligence cron error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cron failed" },
      { status: 500 }
    );
  }
}
