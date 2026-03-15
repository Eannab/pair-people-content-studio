import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

/** Returns a namespaced Vercel KV key for per-user private data. */
export function uk(userId: string, key: string): string {
  return `user:${userId}:${key}`;
}

/** Resolves the authenticated user from the NextAuth session. */
export async function getSessionUser(): Promise<{
  email: string;
  name: string;
} | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return {
    email: session.user.email,
    name: session.user.name ?? session.user.email.split("@")[0],
  };
}

/** Returns a 401 NextResponse — call `return unauthorized()` in route handlers. */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}
