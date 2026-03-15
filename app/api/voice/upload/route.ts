import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getSessionUser, uk, unauthorized } from "@/lib/user-key";

export interface LinkedInPost {
  text: string;
  date: string;
}

// ── CSV parser (handles quoted fields, embedded newlines, CRLF/LF) ──────────

function parseCSV(raw: string): Record<string, string>[] {
  const rows: string[][] = [[]];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    const next = raw[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        rows[rows.length - 1].push(field);
        field = "";
      } else if (c === "\r" && next === "\n") {
        rows[rows.length - 1].push(field);
        field = "";
        rows.push([]);
        i++;
      } else if (c === "\n" || c === "\r") {
        rows[rows.length - 1].push(field);
        field = "";
        rows.push([]);
      } else {
        field += c;
      }
    }
  }
  rows[rows.length - 1].push(field);

  const nonEmpty = rows.filter((r) => r.some((f) => f.trim() !== ""));
  if (nonEmpty.length < 2) return [];

  const headers = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (row[i] ?? "").trim();
    });
    return obj;
  });
}

function extractPosts(rows: Record<string, string>[]): LinkedInPost[] {
  if (rows.length === 0) return [];

  const keys = Object.keys(rows[0]);

  const textCol =
    ["ShareCommentary", "Content", "Post", "Text", "Description", "Body"].find(
      (c) => keys.includes(c)
    ) ??
    keys.find(
      (k) =>
        k.toLowerCase().includes("comment") ||
        k.toLowerCase().includes("content") ||
        k.toLowerCase().includes("text")
    );

  const dateCol =
    ["Date", "date", "PublishedDate", "CreatedDate", "Timestamp", "PostDate"].find(
      (c) => keys.includes(c)
    ) ??
    keys.find(
      (k) => k.toLowerCase().includes("date") || k.toLowerCase().includes("time")
    );

  if (!textCol) {
    throw new Error(
      `Could not find a post text column. Found columns: ${keys.join(", ")}. ` +
        `LinkedIn's Posts.csv should have a "ShareCommentary" column.`
    );
  }

  return rows
    .filter((r) => r[textCol]?.trim().length > 20)
    .map((r) => ({
      text: r[textCol].trim(),
      date: dateCol ? r[dateCol] : "",
    }))
    .sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "Please upload a CSV file (Posts.csv from your LinkedIn data export)" },
        { status: 400 }
      );
    }

    const raw = await file.text();
    const rows = parseCSV(raw);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "CSV appears to be empty or could not be parsed" },
        { status: 400 }
      );
    }

    const posts = extractPosts(rows);

    if (posts.length === 0) {
      return NextResponse.json(
        {
          error:
            "No posts found in the CSV. Make sure you are uploading Posts.csv from your LinkedIn data export.",
        },
        { status: 400 }
      );
    }

    // Store under the authenticated user's namespace; clear stale profile/assessments
    await kv.set(uk(user.email, "linkedin:posts"), posts);
    await kv.del(uk(user.email, "linkedin:voice_profile"));
    await kv.del(uk(user.email, "linkedin:assessments"));

    return NextResponse.json({ postCount: posts.length, posts });
  } catch (err) {
    console.error("voice/upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
