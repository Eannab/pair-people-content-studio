import { kv } from "@vercel/kv";
import { uk } from "@/lib/user-key";

interface StoredProfile {
  summary: string;
  averageLength: number;
  typicalStructure: string;
}

/**
 * Returns a string to append to a system prompt containing the user's
 * LinkedIn voice profile, or an empty string if none is stored.
 *
 * Pass the authenticated user's email so each user gets their own profile.
 */
export async function getVoiceContext(userId?: string): Promise<string> {
  try {
    const key = userId ? uk(userId, "linkedin:voice_profile") : "linkedin:voice_profile";
    const profile = await kv.get<StoredProfile>(key);
    if (!profile?.summary) return "";

    const displayName = userId
      ? userId.split("@")[0].replace(".", " ")
      : "the author";

    return (
      `\n\n## ${displayName}'s Established LinkedIn Voice` +
      `\n${profile.summary}` +
      `\n\nTarget post length: ~${profile.averageLength} characters. ` +
      `Typical structure: ${profile.typicalStructure}`
    );
  } catch {
    return "";
  }
}
