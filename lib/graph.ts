// Thin wrapper around Microsoft Graph fetch calls.
// Throws a GraphAuthError on 401 so callers can return a 401 to the client,
// which then triggers a NextAuth session re-fetch / sign-in prompt.

export class GraphAuthError extends Error {
  constructor(message = "Microsoft Graph authentication failed") {
    super(message);
    this.name = "GraphAuthError";
  }
}

export async function graphFetch(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    let detail = "";
    try {
      const body = await res.clone().json();
      detail = body?.error?.code ?? body?.error ?? "";
    } catch {
      // ignore
    }
    throw new GraphAuthError(
      `Graph API returned 401${detail ? ` (${detail})` : ""}. Token may be expired.`
    );
  }

  return res;
}
