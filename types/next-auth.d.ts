import { DefaultSession } from "next-auth";
import type { UserRole } from "@/lib/authorized-users";

declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string;
    error?: "RefreshAccessTokenError";
    role?: UserRole | null;
    isAuthorized?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    accessTokenExpires?: number;
    refreshToken?: string;
    error?: "RefreshAccessTokenError";
    role?: UserRole | null;
    isAuthorized?: boolean;
  }
}
