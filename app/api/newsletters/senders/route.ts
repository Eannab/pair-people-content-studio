import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { v4 as uuidv4 } from "uuid";

export interface NewsletterSender {
  id: string;
  name: string;    // Display name for fuzzy-matching against from.emailAddress.name
  email: string;   // Optional exact email address for precise matching
  isDefault: boolean;
}

export const DEFAULT_SENDERS: NewsletterSender[] = [
  { id: "default-1", name: "Overnight Success", email: "", isDefault: true },
  { id: "default-2", name: "The Batch", email: "", isDefault: true },
  { id: "default-3", name: "TechCrunch", email: "", isDefault: true },
  { id: "default-4", name: "Australian Defence Magazine", email: "", isDefault: true },
];

export async function GET() {
  try {
    const stored = await kv.get<NewsletterSender[]>("newsletters:senders");
    return NextResponse.json({ senders: stored ?? DEFAULT_SENDERS });
  } catch {
    return NextResponse.json({ senders: DEFAULT_SENDERS });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, email } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const current =
      (await kv.get<NewsletterSender[]>("newsletters:senders")) ?? DEFAULT_SENDERS;

    const newSender: NewsletterSender = {
      id: uuidv4(),
      name: name.trim(),
      email: email?.trim() ?? "",
      isDefault: false,
    };

    const updated = [...current, newSender];
    await kv.set("newsletters:senders", updated);
    return NextResponse.json({ senders: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add sender" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    const current =
      (await kv.get<NewsletterSender[]>("newsletters:senders")) ?? DEFAULT_SENDERS;

    const updated = current.filter((s) => s.id !== id);
    await kv.set("newsletters:senders", updated);
    return NextResponse.json({ senders: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to remove sender" },
      { status: 500 }
    );
  }
}
