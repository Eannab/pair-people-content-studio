import { kv } from "@vercel/kv";
import type { BDLead } from "@/app/api/bd/signals/route";

export interface CVCandidate {
  id: string;
  name: string;
  currentRole: string;
  yearsExperience: number;
  skills: string[];
  sectorExperience: string[];
  location: string;
  seniority: "junior" | "mid" | "senior" | "lead" | "principal";
  fileName: string;
  indexedAt: string;
}

export interface CVMatch {
  candidate: CVCandidate;
  score: number;
  fitExplanation: string;
}

export async function getTopCVMatches(
  lead: BDLead,
  topN = 2,
  minScore = 7
): Promise<CVMatch[]> {
  let index: CVCandidate[] = [];
  try {
    index = (await kv.get<CVCandidate[]>("cv:index")) ?? [];
  } catch {
    return [];
  }

  if (index.length === 0) return [];

  const sectorKeywords: Record<string, string[]> = {
    ai: ["machine learning", "ml", "ai", "deep learning", "nlp", "llm", "python", "pytorch", "tensorflow", "data science"],
    defence: ["defence", "defense", "deeptech", "embedded", "systems", "c++", "rust", "firmware", "aerospace", "satellite"],
    healthtech: ["health", "healthcare", "clinical", "medical", "hl7", "fhir", "biotech", "pharma"],
    sydney: ["sydney", "australia", "nsw"],
    general: [],
  };

  const leadKeywords = sectorKeywords[lead.sector] ?? [];
  const leadTechStack = lead.techStack.map((t) => t.toLowerCase());

  const scored: CVMatch[] = index.map((c) => {
    let score = 5;
    const candidateText = [
      c.currentRole,
      ...c.skills,
      ...c.sectorExperience,
      c.location,
    ]
      .join(" ")
      .toLowerCase();

    // Sector alignment
    const sectorMatches = leadKeywords.filter((kw) =>
      candidateText.includes(kw)
    ).length;
    score += Math.min(sectorMatches * 0.5, 2);

    // Tech stack overlap
    const stackMatches = leadTechStack.filter((t) => candidateText.includes(t)).length;
    score += Math.min(stackMatches * 0.5, 1.5);

    // Experience depth
    if (c.yearsExperience >= 7) score += 0.5;
    else if (c.yearsExperience < 2) score -= 0.5;

    // Sector experience direct match
    if (c.sectorExperience.some((s) => s.toLowerCase().includes(lead.sector))) score += 1;

    score = Math.min(10, Math.max(1, Math.round(score * 10) / 10));

    const reasons: string[] = [];
    if (sectorMatches > 0)
      reasons.push(`${sectorMatches} ${lead.sector} keyword matches`);
    if (stackMatches > 0)
      reasons.push(`${stackMatches} tech stack overlaps`);
    if (c.sectorExperience.some((s) => s.toLowerCase().includes(lead.sector)))
      reasons.push(`direct ${lead.sector} sector experience`);
    if (c.yearsExperience >= 7) reasons.push(`${c.yearsExperience}yr experience`);

    const fitExplanation =
      reasons.length > 0
        ? `${c.name} matches because: ${reasons.join(", ")}.`
        : `${c.name} is a potential match at the ${c.seniority} level.`;

    return { candidate: c, score, fitExplanation };
  });

  return scored
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
