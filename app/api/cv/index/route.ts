import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { v4 as uuidv4 } from "uuid";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { graphFetch } from "@/lib/graph";
import type { CVCandidate } from "@/lib/cv-context";

export const maxDuration = 60;

const BATCH_SIZE = 5;

const FOLDER_URL =
  "https://graph.microsoft.com/v1.0/me/drive/root:/CV%27s:/children?$top=200&$select=id,name,file";

type DriveItem = { id: string; name: string; file?: object };

// GET — return index stats + candidates
export async function GET() {
  try {
    const [indexRecord, indexedFileIds] = await Promise.all([
      kv.get<Record<string, CVCandidate>>("cv:index"),
      kv.get<string[]>("cv:indexed-file-ids"),
    ]);
    const candidates = Object.values(indexRecord ?? {});
    return NextResponse.json({
      count: candidates.length,
      indexedFileCount: (indexedFileIds ?? []).length,
      candidates,
    });
  } catch (err) {
    console.error("[cv/index] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load index" },
      { status: 500 }
    );
  }
}

// POST — index next batch of CV files as stubs (no download, no parsing)
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

    // ── List all files in the CV's folder ────────────────────────────────────
    const allItems: DriveItem[] = [];
    let nextUrl: string | null = FOLDER_URL;

    while (nextUrl) {
      const res = await graphFetch(nextUrl, accessToken);
      const bodyText = await res.text().catch(() => "");

      if (!res.ok) {
        let msg = `Graph API ${res.status}`;
        try { msg = (JSON.parse(bodyText) as { error?: { message?: string } })?.error?.message ?? msg; }
        catch { if (bodyText) msg = bodyText.substring(0, 200); }
        return NextResponse.json({ error: `OneDrive list failed: ${msg}` }, { status: 502 });
      }

      let page: { value?: DriveItem[]; "@odata.nextLink"?: string };
      try { page = JSON.parse(bodyText); }
      catch {
        return NextResponse.json(
          { error: `Unexpected OneDrive response: ${bodyText.substring(0, 120)}` },
          { status: 502 }
        );
      }

      allItems.push(...(page.value ?? []));
      nextUrl = page["@odata.nextLink"] ?? null;
    }

    const cvFiles = allItems.filter((f) => {
      if (!f.file) return false;
      const n = f.name.toLowerCase();
      return n.endsWith(".pdf") || n.endsWith(".docx") || n.endsWith(".doc");
    });

    // ── Determine pending files ───────────────────────────────────────────────
    const [existingIndexRecord, indexedFileIds] = await Promise.all([
      kv.get<Record<string, CVCandidate>>("cv:index"),
      kv.get<string[]>("cv:indexed-file-ids"),
    ]);
    const existingIndex = existingIndexRecord ?? {};
    const indexedSet = new Set<string>(indexedFileIds ?? []);

    const pending = cvFiles.filter((f) => !indexedSet.has(f.id));

    if (pending.length === 0) {
      return NextResponse.json({
        count: Object.keys(existingIndex).length,
        batchProcessed: 0,
        remainingFiles: 0,
        done: true,
      });
    }

    const batch = pending.slice(0, BATCH_SIZE);
    const remainingFiles = pending.length - batch.length;

    // ── Create stub candidates from filenames only ────────────────────────────
    const now = new Date().toISOString();
    const newCandidates: CVCandidate[] = batch.map((file) => ({
      id: uuidv4(),
      name: file.name.replace(/\.[^.]+$/, ""),
      currentRole: "",
      currentEmployer: "",
      yearsExperience: 0,
      skills: [],
      sectorExperience: [],
      location: "",
      seniority: "mid",
      fileName: file.name,
      fileModifiedAt: "",
      indexedAt: now,
      enriched: false,
    }));

    // ── Persist ───────────────────────────────────────────────────────────────
    const mergedIndex = { ...existingIndex };
    for (const c of newCandidates) mergedIndex[c.id] = c;
    const updatedFileIds = [...indexedSet, ...batch.map((f) => f.id)];

    try {
      await Promise.all([
        kv.set("cv:index", mergedIndex),
        kv.set("cv:indexed-file-ids", updatedFileIds),
      ]);
    } catch (kvErr) {
      console.error("[cv/index] KV write failed:", kvErr);
      throw kvErr;
    }

    const count = Object.keys(mergedIndex).length;
    console.log(`[cv/index] indexed ${batch.length} stubs, total=${count}, remaining=${remainingFiles}`);

    return NextResponse.json({
      count,
      batchProcessed: batch.length,
      remainingFiles,
      done: remainingFiles === 0,
    });
  } catch (err) {
    console.error("[cv/index] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Indexing failed" },
      { status: 500 }
    );
  }
}
