import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import type { CVCandidate } from "@/lib/cv-context";

export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST — enrich a single already-indexed candidate with Claude extraction
// Body: { candidateId: string, text: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const candidateId: string | undefined = body.candidateId;
    const text: string | undefined = body.text;

    if (!candidateId || !text) {
      return NextResponse.json({ error: "candidateId and text required" }, { status: 400 });
    }

    const indexRecord = (await kv.get<Record<string, CVCandidate>>("cv:index")) ?? {};
    const candidate = indexRecord[candidateId];

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const truncated = text.trim().substring(0, 3000);

    const extractRes = await anthropic.messages.create({
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

    const enriched: CVCandidate = {
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

    indexRecord[candidateId] = enriched;
    await kv.set("cv:index", indexRecord);

    console.log(`[cv/enrich] enriched ${enriched.fileName} → ${enriched.name}`);

    return NextResponse.json({ candidate: enriched });
  } catch (err) {
    console.error("cv/enrich POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Enrichment failed" },
      { status: 500 }
    );
  }
}
