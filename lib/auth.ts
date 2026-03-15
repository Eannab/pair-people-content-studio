import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import type { JWT } from "next-auth/jwt";

const tenantId = process.env.AZURE_AD_TENANT_ID;
if (!tenantId) {
  console.error(
    "[next-auth] AZURE_AD_TENANT_ID is not set. " +
      "Set it to your Azure Directory (tenant) ID in Vercel environment variables."
  );
}

// The scopes we request — must match what's granted in the Azure app registration.
const SCOPES =
  "openid profile email User.Read Mail.Read Files.Read.All offline_access";

// Refresh the access token using the stored refresh_token.
// Returns an updated token on success, or a token with error="RefreshAccessTokenError" on failure.
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const url = `https://login.microsoftonline.com/${tenantId ?? "common"}/oauth2/v2.0/token`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AZURE_AD_CLIENT_ID!,
        client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken!,
        scope: SCOPES,
      }),
    });

    const refreshed = await response.json();

    if (!response.ok) {
      console.error("[next-auth] Token refresh failed:", refreshed);
      throw new Error(refreshed.error_description ?? "Token refresh failed");
    }

    console.log("[next-auth] Token refreshed successfully");

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      // Use new refresh token if returned, otherwise keep the existing one.
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch (error) {
    console.error("[next-auth] refreshAccessToken error:", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,

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
      tenantId: tenantId ?? "common",
      authorization: {
        params: {
          scope: SCOPES,
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account }) {
      // First sign-in: store all token data including the refresh token.
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000,
          refreshToken: account.refresh_token,
          error: undefined,
        };
      }

      // Token still valid — return as-is (with a 5-minute buffer before expiry).
      const expiresAt = token.accessTokenExpires ?? 0;
      if (Date.now() < expiresAt - 5 * 60 * 1000) {
        return token;
      }

      // Token expired (or within 5 minutes of expiry) — attempt silent refresh.
      if (!token.refreshToken) {
        console.warn("[next-auth] No refresh token available, cannot refresh.");
        return { ...token, error: "RefreshAccessTokenError" };
      }

      return refreshAccessToken(token);
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken;
      // Bubble the error up to the client so it can prompt re-auth.
      session.error = token.error;
      return session;
    },
  },
};
