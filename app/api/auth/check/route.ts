import { NextResponse } from "next/server";

/**
 * GET /api/auth/check
 *
 * Returns which NextAuth / Azure AD environment variables are present.
 * Does NOT expose values — only reports presence/absence and safe prefix.
 * Visit this URL to quickly diagnose a missing env var.
 */
export async function GET() {
  const vars = {
    NEXTAUTH_SECRET: {
      set: !!process.env.NEXTAUTH_SECRET,
      note: "Required. Generate with: openssl rand -base64 32",
    },
    NEXTAUTH_URL: {
      set: !!process.env.NEXTAUTH_URL,
      value: process.env.NEXTAUTH_URL ?? "(not set — NextAuth will try to infer from request)",
      note: "Should be https://pair-people-content-studio.vercel.app",
    },
    AZURE_AD_CLIENT_ID: {
      set: !!process.env.AZURE_AD_CLIENT_ID,
      prefix: process.env.AZURE_AD_CLIENT_ID?.slice(0, 8) ?? "(not set)",
      note: "Application (client) ID from Azure app registration",
    },
    AZURE_AD_CLIENT_SECRET: {
      set: !!process.env.AZURE_AD_CLIENT_SECRET,
      prefix: process.env.AZURE_AD_CLIENT_SECRET?.slice(0, 4) ?? "(not set)",
      note: "Client secret value from Azure Certificates & secrets",
    },
    AZURE_AD_TENANT_ID: {
      set: !!process.env.AZURE_AD_TENANT_ID,
      prefix: process.env.AZURE_AD_TENANT_ID?.slice(0, 8) ?? "(not set — falls back to 'common', which causes issuer mismatch)",
      note: "Directory (tenant) ID from Azure app registration overview",
    },
  };

  const missing = Object.entries(vars)
    .filter(([, v]) => !v.set)
    .map(([k]) => k);

  return NextResponse.json(
    {
      ok: missing.length === 0,
      missing,
      vars,
      callbackUrl: `${process.env.NEXTAUTH_URL ?? "(NEXTAUTH_URL not set)"}/api/auth/callback/azure-ad`,
    },
    { status: missing.length > 0 ? 500 : 200 }
  );
}
