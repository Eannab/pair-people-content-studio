export interface BraveResult {
  title: string;
  description: string;
  url: string;
}

export async function braveSearch(query: string, count = 5): Promise<BraveResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.web?.results ?? []) as BraveResult[];
  } catch {
    return [];
  }
}

export function formatResults(results: BraveResult[]): string {
  return results.map((r) => `${r.title}: ${r.description}`).join("\n");
}
