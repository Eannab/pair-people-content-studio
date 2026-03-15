import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import { v4 as uuidv4 } from "uuid";
import type { CVCandidate } from "@/lib/cv-context";
import type { CVSettings } from "@/app/api/cv/settings/route";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET — return current CV index
export async function GET() {
  try {
    const index = (await kv.get<CVCandidate[]>("cv:index")) ?? [];
    return NextResponse.json({ candidates: index, count: index.length });
  } catch (err) {
    console.error("cv/index GET error:", err);
    return NextResponse.json({ error: "Failed to load index" }, { status: 500 });
  }
}

// POST — rebuild the CV index from OneDrive
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const accessToken: string | undefined = body.accessToken;

    if (!accessToken) {
      return NextResponse.json({ error: "accessToken required" }, { status: 400 });
    }

    const settings = await kv.get<CVSettings>("cv:settings");
    const folderPath = settings?.folderPath?.trim() || "/Active CVs";

    // ── List files in the OneDrive folder ────────────────────────────────────
    const encodedPath = encodeURIComponent(folderPath);
    const listRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:${encodedPath}:/children?$filter=file ne null&$select=id,name,file`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listRes.ok) {
      const errText = await listRes.text();
      return NextResponse.json(
        { error: `OneDrive list failed: ${listRes.status} ${errText}` },
        { status: 502 }
      );
    }

    const listData = await listRes.json();
    const files: Array<{ id: string; name: string; file: { mimeType: string } }> =
      listData.value ?? [];

    const cvFiles = files.filter((f) => {
      const name = f.name.toLowerCase();
      return (
        name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".doc")
      );
    });

    if (cvFiles.length === 0) {
      return NextResponse.json({
        candidates: [],
        count: 0,
        message: `No PDF or DOCX files found in ${folderPath}`,
      });
    }

    // ── Process each file ────────────────────────────────────────────────────
    const now = new Date().toISOString();
    const candidates: CVCandidate[] = [];

    for (const file of cvFiles) {
      try {
        // Download file content
        const downloadRes = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/content`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!downloadRes.ok) continue;

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

        // Extract structured data with Claude Haiku
        const extractRes = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 600,
          messages: [
            {
              role: "user",
              content: `Extract candidate info from this CV. Return JSON only:
{"name":"...", "currentRole":"...", "yearsExperience":5, "skills":["TypeScript","React"], "sectorExperience":["fintech","healthtech"], "location":"Sydney, Australia", "seniority":"senior"}

seniority options: "junior" (0-2yr), "mid" (2-5yr), "senior" (5-10yr), "lead" (team lead), "principal" (staff+)

CV text:
${truncated}

Return ONLY the JSON object.`,
            },
          ],
        });

        const raw =
          extractRes.content[0].type === "text"
            ? extractRes.content[0].text.trim()
            : "{}";
        const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

        let extracted: Partial<CVCandidate> = {};
        try {
          extracted = JSON.parse(clean);
        } catch {
          extracted = {};
        }

        if (!extracted.name) continue;

        candidates.push({
          id: uuidv4(),
          name: extracted.name ?? file.name,
          currentRole: extracted.currentRole ?? "",
          yearsExperience: extracted.yearsExperience ?? 0,
          skills: extracted.skills ?? [],
          sectorExperience: extracted.sectorExperience ?? [],
          location: extracted.location ?? "",
          seniority: extracted.seniority ?? "mid",
          fileName: file.name,
          indexedAt: now,
        });
      } catch (fileErr) {
        console.error(`Error processing ${file.name}:`, fileErr);
      }
    }

    await kv.set("cv:index", candidates);

    return NextResponse.json({ candidates, count: candidates.length });
  } catch (err) {
    console.error("cv/index POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Indexing failed" },
      { status: 500 }
    );
  }
}
