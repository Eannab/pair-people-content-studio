import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";

const tenantId = process.env.AZURE_AD_TENANT_ID;
if (!tenantId) {
  console.error(
    "[next-auth] AZURE_AD_TENANT_ID is not set. " +
      "Set it to your Azure Directory (tenant) ID in Vercel environment variables."
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  // Writes verbose logs to Vercel's function output — visible in the
  // Vercel dashboard under Deployments → Functions → [request] → Logs.
  debug: true,

  logger: {
    error(code, ...message) {
      console.error("[next-auth][error]", code, ...message);
    },
    warn(code, ...message) {
      console.warn("[next-auth][warn]", code, ...message);
    },
    debug(code, ...message) {
      console.log("[next-auth][debug]", code, ...message);
    },
  },

  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      // Specific tenant ID is required. "common" causes issuer-mismatch
      // errors when Azure is registered under a specific tenant.
      tenantId: tenantId ?? "common",
      authorization: {
        params: {
          scope: "openid profile email User.Read Mail.Read offline_access",
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      return session;
    },
  },
};
