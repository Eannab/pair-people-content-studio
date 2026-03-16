import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { graphFetch } from "@/lib/graph";
import type { CVCandidate } from "@/lib/cv-context";

export const maxDuration = 60;

const BATCH_SIZE = 2;
const FILE_TIMEOUT_MS = 25_000;


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

// POST — enrich next batch of stub candidates using Claude's native PDF reading
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: "Not authenticated. Please sign in with Microsoft." },
        { status: 401 }
      );
    }
    const accessToken = session.accessToken;

    // ── Find unenriched candidates ────────────────────────────────────────────
    const indexRecord = (await kv.get<Record<string, CVCandidate>>("cv:index")) ?? {};
    const all = Object.values(indexRecord);
    const unenriched = all.filter((c) => !c.enriched);

    if (unenriched.length === 0) {
      return NextResponse.json({ enriched: 0, remaining: 0, total: all.length, done: true });
    }

    const batch = unenriched.slice(0, BATCH_SIZE);
    let enrichedThisBatch = 0;

    for (const candidate of batch) {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
        console.warn(`[cv/enrich] timeout (${FILE_TIMEOUT_MS}ms) for ${candidate.fileName} — skipping`);
      }, FILE_TIMEOUT_MS);

      try {
        // ── Skip non-PDF files — Anthropic only supports PDF as document type ─
        const ext = candidate.fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
        if (ext !== ".pdf") {
          console.log(`[cv/enrich] skipping ${candidate.fileName} (${ext} not supported)`);
          indexRecord[candidate.id] = { ...candidate, enriched: true, enrichmentSkipped: true };
          await kv.set("cv:index", indexRecord);
          continue;
        }

        // ── Download file from OneDrive ───────────────────────────────────────
        const encodedName = encodeURIComponent(candidate.fileName).replace(/'/g, "%27");
        const downloadRes = await graphFetch(
          `https://graph.microsoft.com/v1.0/me/drive/root:/CV%27s/${encodedName}:/content`,
          accessToken,
          { signal: controller.signal }
        );

        if (!downloadRes.ok) {
          const errBody = await downloadRes.text().catch(() => "");
          console.warn(`[cv/enrich] download failed for ${candidate.fileName}: ${downloadRes.status} ${errBody.substring(0, 200)}`);
          // Mark as enriched=true with downloadFailed so it's not retried
          indexRecord[candidate.id] = { ...candidate, enriched: true, downloadFailed: true };
          await kv.set("cv:index", indexRecord);
          continue;
        }

        const buffer = Buffer.from(await downloadRes.arrayBuffer());
        const base64 = buffer.toString("base64");

        // ── Call Claude with native document reading ──────────────────────────
        const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
          signal: controller.signal,
          method: "POST",
          headers: {
            "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
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
                    text: 'Extract the following from this CV and respond ONLY with valid JSON, no markdown fences:\n{"name":"full name","currentRole":"most recent job title","skills":["skill1","skill2"],"sectorExperience":["sector1","sector2"],"seniority":"junior|mid|senior|principal","yearsExperience":0,"location":"city, state/country"}',
                  },
                ],
              },
            ],
          }),
        });

        if (!claudeRes.ok) {
          const claudeErr = await claudeRes.text().catch(() => "");
          const reason = `Claude ${claudeRes.status}: ${claudeErr.substring(0, 150)}`;
          console.warn(`[cv/enrich] Claude failed for ${candidate.fileName}: ${reason}`);
          indexRecord[candidate.id] = { ...candidate, enriched: true, enrichmentError: `failed: ${reason}` };
          await kv.set("cv:index", indexRecord);
          continue;
        }

        const claudeData = await claudeRes.json() as {
          content: { type: string; text: string }[];
        };
        const raw = claudeData.content?.[0]?.type === "text" ? claudeData.content[0].text.trim() : "{}";

        let extracted: Partial<CVCandidate> = {};
        try {
          extracted = JSON.parse(raw);
        } catch {
          console.warn(`[cv/enrich] JSON parse failed for ${candidate.fileName}: ${raw.substring(0, 100)}`);
        }

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

        enrichedThisBatch++;
        console.log(`[cv/enrich] enriched ${candidate.fileName} → ${extracted.name ?? candidate.name}`);
      } catch (candidateErr) {
        if (candidateErr instanceof Error && candidateErr.name === "AbortError") {
          // Timed out — leave enriched: false so it's retried next batch
        } else {
          const msg = candidateErr instanceof Error ? candidateErr.message : String(candidateErr);
          console.error(`[cv/enrich] unexpected error for ${candidate.fileName}:`, msg);
          indexRecord[candidate.id] = { ...candidate, enriched: true, enrichmentError: `failed: ${msg}` };
        }
      } finally {
        clearTimeout(timer);
      }
    }

    await kv.set("cv:index", indexRecord);

    const updatedAll = Object.values(indexRecord);
    const remaining = updatedAll.filter((c) => !c.enriched).length;

    return NextResponse.json({
      enriched: enrichedThisBatch,
      remaining,
      total: updatedAll.length,
      done: remaining === 0,
    });
  } catch (err) {
    console.error("[cv/enrich] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Enrichment failed" },
      { status: 500 }
    );
  }
}

