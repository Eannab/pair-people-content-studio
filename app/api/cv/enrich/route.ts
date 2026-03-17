import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { graphFetch } from "@/lib/graph";
import type { CVCandidate } from "@/lib/cv-context";

export const maxDuration = 60;

// GET — return enrichment stats
export async function GET() {
  try {
    const indexRecord = (await kv.get<Record<string, CVCandidate>>("cv:index")) ?? {};
    const candidates = Object.values(indexRecord);
    const enrichedCount = candidates.filter((c) => c.enriched).length;
    return NextResponse.json({
      total: candidates.length,
      enrichedCount,
      unenrichedCount: candidates.length - enrichedCount,
    });
  } catch (err) {
    console.error("[cv/enrich] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load stats" },
      { status: 500 }
    );
  }
}

// POST — enrich one candidate at a time
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Not authenticated. Please sign in with Microsoft." },
      { status: 401 }
    );
  }
  const accessToken = session.accessToken;

  const indexRecord = (await kv.get<Record<string, CVCandidate>>("cv:index")) ?? {};
  const all = Object.values(indexRecord);

  // Find first unenriched, non-skipped, non-errored candidate
  const candidate = all.find(
    (c) => !c.enriched && !c.enrichmentSkipped && !c.enrichmentError
  ) ?? null;

  const remaining = all.filter(
    (c) => !c.enriched && !c.enrichmentSkipped && !c.enrichmentError
  ).length;

  if (!candidate) {
    return NextResponse.json({ done: true, remaining: 0 });
  }

  const countAfter = remaining - 1;

  // Skip non-PDF files
  const ext = candidate.fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  if (ext !== ".pdf") {
    // Find the actual KV key for this candidate (by id first, then by fileName fallback)
    const kvKey =
      candidate.id && indexRecord[candidate.id]?.fileName === candidate.fileName
        ? candidate.id
        : Object.keys(indexRecord).find((k) => indexRecord[k].fileName === candidate.fileName);

    if (kvKey) {
      indexRecord[kvKey] = { ...indexRecord[kvKey], enrichmentSkipped: true };
    } else {
      console.warn(`[cv/enrich] could not find KV key for ${candidate.fileName} — skipping without persisting`);
    }

    await kv.set("cv:index", indexRecord, { ex: 60 * 60 * 24 * 30 });
    console.log(`[cv/enrich] skipped ${candidate.fileName} (${ext}), kvKey=${kvKey}`);
    return NextResponse.json({ skipped: candidate.fileName, remaining: countAfter });
  }

  // Download PDF from OneDrive
  const encodedName = encodeURIComponent(candidate.fileName).replace(/'/g, "%27");
  let base64: string;
  try {
    const downloadRes = await graphFetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:/CV%27s/${encodedName}:/content`,
      accessToken
    );
    if (!downloadRes.ok) {
      const errBody = await downloadRes.text().catch(() => "");
      const reason = `Download ${downloadRes.status}: ${errBody.substring(0, 150)}`;
      console.warn(`[cv/enrich] download failed for ${candidate.fileName}: ${reason}`);
      indexRecord[candidate.id] = { ...candidate, enrichmentError: reason };
      await kv.set("cv:index", indexRecord);
      return NextResponse.json({ failed: candidate.fileName, reason, remaining: countAfter });
    }
    const buffer = Buffer.from(await downloadRes.arrayBuffer());
    base64 = buffer.toString("base64");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[cv/enrich] download error for ${candidate.fileName}: ${reason}`);
    indexRecord[candidate.id] = { ...candidate, enrichmentError: reason };
    await kv.set("cv:index", indexRecord);
    return NextResponse.json({ failed: candidate.fileName, reason, remaining: countAfter });
  }

  // Call Claude with native PDF reading
  let extracted: Partial<CVCandidate> = {};
  try {
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 },
              },
              {
                type: "text",
                text: 'Extract the following from this CV and respond ONLY with valid JSON, no markdown fences:\n{"name":"full name","currentRole":"most recent job title","currentEmployer":"most recent employer name","skills":["skill1","skill2"],"sectorExperience":["sector1","sector2"],"seniority":"junior|mid|senior|lead|principal","yearsExperience":0,"location":"city, state/country"}',
              },
            ],
          },
        ],
      }),
    });

    if (claudeRes.status === 429) {
      console.warn(`[cv/enrich] Claude 429 rate limit for ${candidate.fileName} — not marking error`);
      return NextResponse.json({ rateLimited: true, remaining: countAfter });
    }

    if (!claudeRes.ok) {
      const claudeErr = await claudeRes.text().catch(() => "");
      const reason = `Claude ${claudeRes.status}: ${claudeErr.substring(0, 150)}`;
      console.warn(`[cv/enrich] Claude failed for ${candidate.fileName}: ${reason}`);
      const kvKey = Object.keys(indexRecord).find((k) => indexRecord[k].fileName === candidate.fileName) ?? candidate.id;
      indexRecord[kvKey] = { ...candidate, enrichmentError: reason };
      await kv.set("cv:index", indexRecord, { ex: 60 * 60 * 24 * 30 });
      return NextResponse.json({ failed: candidate.fileName, reason, remaining: countAfter });
    }

    const claudeData = await claudeRes.json() as { content: { type: string; text: string }[] };
    const rawText = claudeData.content?.[0]?.type === "text" ? claudeData.content[0].text.trim() : "{}";
    const raw = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    try {
      extracted = JSON.parse(raw);
    } catch {
      console.warn(`[cv/enrich] JSON parse failed for ${candidate.fileName}: ${raw.substring(0, 100)}`);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[cv/enrich] Claude error for ${candidate.fileName}: ${reason}`);
    indexRecord[candidate.id] = { ...candidate, enrichmentError: reason };
    await kv.set("cv:index", indexRecord);
    return NextResponse.json({ failed: candidate.fileName, reason, remaining: countAfter });
  }

  // Save enriched candidate
  indexRecord[candidate.id] = {
    ...candidate,
    name: extracted.name ?? candidate.name,
    currentRole: extracted.currentRole ?? candidate.currentRole,
    currentEmployer: extracted.currentEmployer ?? candidate.currentEmployer,
    yearsExperience: extracted.yearsExperience ?? candidate.yearsExperience,
    skills: extracted.skills ?? candidate.skills,
    sectorExperience: extracted.sectorExperience ?? candidate.sectorExperience,
    location: extracted.location ?? candidate.location,
    seniority: extracted.seniority ?? candidate.seniority,
    enriched: true,
  };
  await kv.set("cv:index", indexRecord);

  console.log(`[cv/enrich] enriched ${candidate.fileName} → ${extracted.name ?? candidate.name}`);
  return NextResponse.json({
    enriched: candidate.fileName,
    remaining: countAfter,
    done: countAfter === 0,
  });
}
