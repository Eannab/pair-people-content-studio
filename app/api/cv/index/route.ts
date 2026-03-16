import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import { v4 as uuidv4 } from "uuid";
import { graphFetch, GraphAuthError } from "@/lib/graph";
import type { CVCandidate } from "@/lib/cv-context";
import type { CVSettings } from "@/app/api/cv/settings/route";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BATCH_SIZE = 5;
const CLAUDE_TIMEOUT_MS = 8000;

// GET — return current CV index
export async function GET() {
  try {
    const indexRecord = (await kv.get<Record<string, CVCandidate>>("cv:index")) ?? {};
    const index = Object.values(indexRecord);
    return NextResponse.json({ candidates: index, count: index.length });
  } catch (err) {
    console.error("cv/index GET error:", err);
    return NextResponse.json({ error: "Failed to load index" }, { status: 500 });
  }
}

// POST — process next batch of CVs from OneDrive
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const accessToken: string | undefined = body.accessToken;

    if (!accessToken) {
      return NextResponse.json({ error: "accessToken required" }, { status: 400 });
    }

    const settings = await kv.get<CVSettings>("cv:settings");
    const folderPath = settings?.folderPath?.trim() || "/Active CVs";

    // ── Pre-flight: verify the token is still valid ───────────────────────────
    {
      const meRes = await graphFetch(
        "https://graph.microsoft.com/v1.0/me?$select=id",
        accessToken
      );
      if (!meRes.ok) {
        const bodyText = await meRes.text().catch(() => "");
        let msg = `Graph API ${meRes.status}`;
        try { msg = (JSON.parse(bodyText) as { error?: { message?: string } })?.error?.message ?? msg; }
        catch { if (bodyText) msg = bodyText.substring(0, 200); }
        return NextResponse.json(
          { error: `Microsoft token check failed: ${msg}` },
          { status: 502 }
        );
      }
    }

    // ── List files in the OneDrive folder ────────────────────────────────────
    const encodedPath = folderPath
      .replace(/^\/+/, "")
      .split("/")
      .map((seg) => encodeURIComponent(seg).replace(/'/g, "%27"))
      .join("/");

    type DriveItem = {
      id: string;
      name: string;
      file?: { mimeType: string };
      lastModifiedDateTime?: string;
    };
    const allItems: DriveItem[] = [];
    let nextUrl: string | null =
      `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/children?$select=id,name,file,lastModifiedDateTime&$top=200`;

    while (nextUrl) {
      const listRes = await graphFetch(nextUrl, accessToken);
      const bodyText = await listRes.text().catch(() => "");

      if (!listRes.ok) {
        let msg = `Graph API ${listRes.status}`;
        try {
          const errBody = JSON.parse(bodyText) as { error?: { message?: string } };
          msg = errBody?.error?.message ?? msg;
        } catch {
          if (bodyText) msg = bodyText.substring(0, 200);
        }
        return NextResponse.json(
          { error: `OneDrive list failed: ${msg}` },
          { status: 502 }
        );
      }

      let listData: { value?: DriveItem[]; "@odata.nextLink"?: string };
      try {
        listData = JSON.parse(bodyText);
      } catch {
        const preview = bodyText.substring(0, 120).replace(/\s+/g, " ");
        return NextResponse.json(
          { error: `OneDrive returned an unexpected response: ${preview}` },
          { status: 502 }
        );
      }

      allItems.push(...(listData.value ?? []));
      nextUrl = listData["@odata.nextLink"] ?? null;
    }

    const files = allItems.filter((item) => item.file !== undefined);
    const cvFiles = files.filter((f) => {
      const name = f.name.toLowerCase();
      return name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".doc");
    });

    if (cvFiles.length === 0) {
      return NextResponse.json({
        candidates: [],
        count: 0,
        batchProcessed: 0,
        batchAttempted: [],
        totalFiles: 0,
        remainingFiles: 0,
        done: true,
        message: `No PDF or DOCX files found in ${folderPath}`,
      });
    }

    // ── Determine which files still need processing ───────────────────────────
    const [existingIndexRecord, indexedFileIds] = await Promise.all([
      kv.get<Record<string, CVCandidate>>("cv:index"),
      kv.get<string[]>("cv:indexed-file-ids"),
    ]);
    const existingIndex = existingIndexRecord ?? {};
    const indexedFileIdSet = new Set<string>(indexedFileIds ?? []);

    const pendingFiles = cvFiles.filter((f) => !indexedFileIdSet.has(f.id));

    if (pendingFiles.length === 0) {
      return NextResponse.json({
        candidates: Object.values(existingIndex),
        count: Object.keys(existingIndex).length,
        batchProcessed: 0,
        batchAttempted: [],
        totalFiles: cvFiles.length,
        remainingFiles: 0,
        done: true,
      });
    }

    const batch = pendingFiles.slice(0, BATCH_SIZE);
    const remainingAfterBatch = pendingFiles.length - batch.length;

    // ── Process each file in the batch ────────────────────────────────────────
    const now = new Date().toISOString();
    const newCandidates: CVCandidate[] = [];
    const processedFileIds: string[] = [];

    for (const file of batch) {
      try {
        const downloadRes = await graphFetch(
          `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/content`,
          accessToken
        );
        if (!downloadRes.ok) {
          console.warn(`[cv/index] download failed for ${file.name}: HTTP ${downloadRes.status}`);
          const fallbackName = file.name.replace(/\.[^.]+$/, "");
          newCandidates.push({
            id: uuidv4(),
            name: fallbackName,
            currentRole: "",
            currentEmployer: "",
            yearsExperience: 0,
            skills: [],
            sectorExperience: [],
            location: "",
            seniority: "mid",
            fileName: file.name,
            fileModifiedAt: file.lastModifiedDateTime ?? "",
            indexedAt: now,
            downloadFailed: true,
          });
          processedFileIds.push(file.id);
          continue;
        }

        const buffer = Buffer.from(await downloadRes.arrayBuffer());
        let text = "";

        if (file.name.toLowerCase().endsWith(".pdf")) {
          const pdfParse = (await import("pdf-parse")).default;
          const parsed = await pdfParse(buffer);
          text = parsed.text;
        } else {
          const mammoth = await import("mammoth");
          const result = await mammoth.extractRawText({ buffer });
          text = result.value;
        }

        if (!text.trim()) continue;

        const truncated = text.trim().substring(0, 3000);

        let extracted: Partial<CVCandidate> = {};
        try {
          const extractRes = await Promise.race([
            anthropic.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 600,
              messages: [
                {
                  role: "user",
                  content: `Extract candidate info from this CV. Return JSON only:
{"name":"...", "currentRole":"...", "currentEmployer":"...", "yearsExperience":5, "skills":["TypeScript","React"], "sectorExperience":["fintech","healthtech"], "location":"Sydney, Australia", "seniority":"senior"}

currentEmployer: the name of the company where they currently work or most recently worked.
seniority options: "junior" (0-2yr), "mid" (2-5yr), "senior" (5-10yr), "lead" (team lead), "principal" (staff+)

CV text:
${truncated}

Return ONLY the JSON object.`,
                },
              ],
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Claude extraction timed out")), CLAUDE_TIMEOUT_MS)
            ),
          ]);
          const raw =
            extractRes.content[0].type === "text"
              ? extractRes.content[0].text.trim()
              : "{}";
          const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
          try {
            extracted = JSON.parse(clean);
          } catch {
            extracted = {};
          }
        } catch (extractErr) {
          console.warn(`[cv/index] Claude extraction failed for ${file.name}: ${extractErr instanceof Error ? extractErr.message : extractErr}`);
        }

        const fallbackName = file.name.replace(/\.[^.]+$/, "");
        newCandidates.push({
          id: uuidv4(),
          name: extracted.name ?? fallbackName,
          currentRole: extracted.currentRole ?? "",
          currentEmployer: extracted.currentEmployer ?? "",
          yearsExperience: extracted.yearsExperience ?? 0,
          skills: extracted.skills ?? [],
          sectorExperience: extracted.sectorExperience ?? [],
          location: extracted.location ?? "",
          seniority: extracted.seniority ?? "mid",
          fileName: file.name,
          fileModifiedAt: file.lastModifiedDateTime ?? "",
          indexedAt: now,
        });
        processedFileIds.push(file.id);
      } catch (fileErr) {
        if (fileErr instanceof GraphAuthError) throw fileErr; // bubble up
        console.error(`Error processing ${file.name}:`, fileErr);
      }
    }

    console.log(`[cv/index] batch attempted: ${batch.length}, extracted by Claude: ${newCandidates.filter(c => c.name !== c.fileName.replace(/\.[^.]+$/, "")).length}, total indexed this batch: ${newCandidates.length}`);

    // ── Merge into existing index and persist ─────────────────────────────────
    const mergedIndexRecord = { ...existingIndex };
    for (const candidate of newCandidates) {
      mergedIndexRecord[candidate.id] = candidate;
    }
    const updatedFileIds = [...indexedFileIdSet, ...processedFileIds];
    await Promise.all([
      kv.set("cv:index", mergedIndexRecord),
      kv.set("cv:indexed-file-ids", updatedFileIds),
    ]);

    const mergedCandidates = Object.values(mergedIndexRecord);
    return NextResponse.json({
      candidates: mergedCandidates,
      count: mergedCandidates.length,
      batchProcessed: newCandidates.length,
      batchAttempted: batch.map((f) => f.name),
      totalFiles: cvFiles.length,
      remainingFiles: remainingAfterBatch,
      done: remainingAfterBatch === 0,
    });
  } catch (err) {
    console.error("cv/index POST error:", err);
    if (err instanceof GraphAuthError) {
      return NextResponse.json(
        { error: "Microsoft session expired. Please reconnect.", tokenExpired: true },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Indexing failed" },
      { status: 500 }
    );
  }
}
