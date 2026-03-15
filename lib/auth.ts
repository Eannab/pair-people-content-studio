import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";

export const authOptions: NextAuthOptions = {
  // Must be set via NEXTAUTH_SECRET env var. Required in production.
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      // Must be the specific tenant ID — do NOT fall back to "common".
      // Using "common" with a specific Azure tenant causes issuer-mismatch
      // failures that silently loop back to the sign-in page.
      tenantId: process.env.AZURE_AD_TENANT_ID,
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

  // Do NOT set pages.error to "/" — that swallows every auth failure
  // silently and causes the sign-in loop. Let NextAuth show its own
  // error page at /api/auth/error so failures are visible.
};
