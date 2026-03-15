/**
 * Pipeline KV helpers.
 *
 * Storage layout (unbounded):
 *   bd:pipeline:index          — Redis sorted set, score = createdAt timestamp, member = id
 *   bd:pipeline:lead:{id}      — individual PipelineLead JSON per entry
 *
 * On first access after deploy the helper migrates the old bd:pipeline array
 * (if it exists) into the new structure automatically.
 */

import { kv } from "@vercel/kv";
import type { PipelineLead } from "@/app/api/bd/pipeline/route";

const INDEX_KEY = "bd:pipeline:index";
const leadKey = (id: string) => `bd:pipeline:lead:${id}`;

// ── Migration ──────────────────────────────────────────────────────────────────

async function migrateIfNeeded(): Promise<void> {
  const indexSize = await kv.zcard(INDEX_KEY);
  if (indexSize > 0) return; // New structure is populated — nothing to do

  const old = await kv.get<PipelineLead[]>("bd:pipeline");
  if (!old || old.length === 0) return; // Nothing in the old key either

  for (const lead of old) {
    const score = new Date(lead.dateAdded).getTime();
    await kv.set(leadKey(lead.id), lead);
    await kv.zadd(INDEX_KEY, { score, member: lead.id });
  }
  // Leave old key intact — it can be manually cleared once confirmed migrated
}

// ── Read ───────────────────────────────────────────────────────────────────────

export async function getPipelineAll(): Promise<PipelineLead[]> {
  await migrateIfNeeded();

  const ids = await kv.zrange<string[]>(INDEX_KEY, 0, -1);
  if (!ids || ids.length === 0) return [];

  const leads = await Promise.all(ids.map((id) => kv.get<PipelineLead>(leadKey(id))));
  return leads.filter((l): l is PipelineLead => l !== null);
}

// ── Write ──────────────────────────────────────────────────────────────────────

export async function addPipelineLead(entry: PipelineLead): Promise<void> {
  const score = new Date(entry.dateAdded).getTime();
  await kv.set(leadKey(entry.id), entry);
  await kv.zadd(INDEX_KEY, { score, member: entry.id });
}

export async function upsertPipelineLeads(
  incoming: PipelineLead[]
): Promise<{ added: number }> {
  await migrateIfNeeded();

  const ids = await kv.zrange<string[]>(INDEX_KEY, 0, -1);
  let existingNames = new Set<string>();

  if (ids.length > 0) {
    const existing = await Promise.all(ids.map((id) => kv.get<PipelineLead>(leadKey(id))));
    existingNames = new Set(
      existing
        .filter((l): l is PipelineLead => l !== null)
        .map((l) => l.companyName.toLowerCase())
    );
  }

  const toAdd = incoming.filter(
    (l) => !existingNames.has(l.companyName.toLowerCase())
  );

  for (const lead of toAdd) {
    await addPipelineLead(lead);
  }

  return { added: toAdd.length };
}

// ── Update ─────────────────────────────────────────────────────────────────────

export async function updatePipelineLead(
  id: string,
  updates: Partial<Pick<PipelineLead, "status" | "notes">>
): Promise<PipelineLead | null> {
  const lead = await kv.get<PipelineLead>(leadKey(id));
  if (!lead) return null;
  const updated: PipelineLead = {
    ...lead,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(leadKey(id), updated);
  return updated;
}

// ── Delete ─────────────────────────────────────────────────────────────────────

export async function deletePipelineLead(id: string): Promise<void> {
  await kv.del(leadKey(id));
  await kv.zrem(INDEX_KEY, id);
}

// ── Name existence check (for duplicate prevention) ───────────────────────────

export async function pipelineNameExists(name: string): Promise<PipelineLead | null> {
  const all = await getPipelineAll();
  return all.find((l) => l.companyName.toLowerCase() === name.toLowerCase()) ?? null;
}
