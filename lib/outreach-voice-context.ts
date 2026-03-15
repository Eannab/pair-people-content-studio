import { kv } from "@vercel/kv";
import { uk } from "@/lib/user-key";
import type { OutreachVoiceProfile } from "@/app/api/voice/outreach/route";

/**
 * Returns a string to append to a BD outreach prompt containing the user's
 * analysed email outreach style, or an empty string if none is stored.
 */
export async function getOutreachVoiceContext(userId?: string): Promise<string> {
  try {
    const key = userId
      ? uk(userId, "outreach:voice_profile")
      : "outreach:voice_profile";
    const profile = await kv.get<OutreachVoiceProfile>(key);
    if (!profile) return "";

    const topPatterns =
      profile.topPerformingPatterns?.length > 0
        ? `\nTop performing patterns: ${profile.topPerformingPatterns.join("; ")}`
        : "";

    const phrases =
      profile.distinctivePhrases?.length > 0
        ? `\nDistinctive phrases/habits: ${profile.distinctivePhrases.join("; ")}`
        : "";

    return (
      `\n\n## Actual Email Outreach Style (learned from ${profile.emailsAnalysed} sent emails, ${profile.responseRate})` +
      `\nTone: ${profile.tone}` +
      `\nTypical length: ${profile.typicalLength}` +
      `\nStructure: ${profile.typicalStructure}` +
      `\nOpening style: ${profile.openingStyle}` +
      `\nHow candidates are described: ${profile.candidateDescriptionStyle}` +
      `\nHow companies are described: ${profile.companyDescriptionStyle}` +
      `\nCTA style: ${profile.ctaStyle}` +
      topPatterns +
      phrases +
      `\n\nMatch this style closely. Do not write in a generic corporate tone.`
    );
  } catch {
    return "";
  }
}
