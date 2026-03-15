import { kv } from "@vercel/kv";

export interface LinkedInInsight {
  id: string;
  title: string;
  observation: string;
  examplePost: string;
  exampleAuthor: string;
  applicablePostTypes: string[];
  group: "boutique_recruitment" | "non_recruitment_tech" | "au_startup";
  generatedAt: string;
}

export interface LinkedInIntelligenceReport {
  insights: LinkedInInsight[];
  generatedAt: string;
  coversPeriod: string;
}

export async function getLinkedInInsightsContext(postType?: string): Promise<string> {
  let report: LinkedInIntelligenceReport | null = null;
  try {
    report = await kv.get<LinkedInIntelligenceReport>("research:linkedin_intelligence");
  } catch {
    return "";
  }

  if (!report || report.insights.length === 0) return "";

  const relevant = postType
    ? report.insights.filter(
        (i) =>
          i.applicablePostTypes.length === 0 ||
          i.applicablePostTypes.some(
            (t) => t.toLowerCase() === postType.toLowerCase()
          )
      )
    : report.insights;

  const top = relevant.slice(0, 3);
  if (top.length === 0) return "";

  const lines = top.map(
    (i, n) =>
      `${n + 1}. ${i.title}: ${i.observation}${
        i.examplePost ? ` Example: "${i.examplePost.substring(0, 120)}..."` : ""
      }`
  );

  return `\n\nWhat's working on LinkedIn right now (${report.coversPeriod}):\n${lines.join("\n")}\nApply these as awareness — don't imitate, let them inform structure and tone.`;
}
