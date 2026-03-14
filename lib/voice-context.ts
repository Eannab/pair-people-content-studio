import { kv } from "@vercel/kv";

interface StoredProfile {
  summary: string;
  averageLength: number;
  typicalStructure: string;
}

/**
 * Returns a string to append to a system prompt with Eanna's voice profile,
 * or an empty string if no profile is stored or KV is unavailable.
 */
export async function getVoiceContext(): Promise<string> {
  try {
    const profile = await kv.get<StoredProfile>("linkedin:voice_profile");
    if (!profile?.summary) return "";
    return (
      `\n\n## Eanna's Established LinkedIn Voice` +
      `\n${profile.summary}` +
      `\n\nTarget post length: ~${profile.averageLength} characters. ` +
      `Typical structure: ${profile.typicalStructure}`
    );
  } catch {
    return "";
  }
}
