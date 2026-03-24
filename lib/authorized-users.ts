import { kv } from "@vercel/kv";

export type UserRole = "admin" | "viewer";

export interface AuthorizedUser {
  email: string;
  role: UserRole;
}

const KV_KEY = "app:authorized-users";

export async function getAuthorizedUsers(): Promise<AuthorizedUser[]> {
  return (await kv.get<AuthorizedUser[]>(KV_KEY)) ?? [];
}

export async function setAuthorizedUsers(users: AuthorizedUser[]): Promise<void> {
  await kv.set(KV_KEY, users);
}

export async function getUserRole(email: string): Promise<UserRole | null> {
  const users = await getAuthorizedUsers();
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  return user?.role ?? null;
}

/** Seeds the list with eanna@pairpeople.com.au (admin) if the key is missing or empty. */
export async function initializeUsersIfEmpty(): Promise<void> {
  const existing = await kv.get<AuthorizedUser[]>(KV_KEY);
  if (!existing || existing.length === 0) {
    await kv.set(KV_KEY, [{ email: "eanna@pairpeople.com.au", role: "admin" as UserRole }]);
  }
}
