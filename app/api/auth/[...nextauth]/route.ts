import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

// Wrap in explicit try/catch so any crash during the OAuth callback
// is written to Vercel function logs before the error page renders.
async function wrappedHandler(req: NextRequest, ctx: unknown) {
  try {
    return await (handler as (req: NextRequest, ctx: unknown) => Promise<Response>)(req, ctx);
  } catch (err) {
    console.error("[next-auth] Unhandled exception in route handler:", err);
    throw err;
  }
}

export { wrappedHandler as GET, wrappedHandler as POST };
