import type { XhsNote } from "../types/xhs.js";
import type { ScrapeError } from "./types.js";
import { AsyncQueue } from "./queue.js";
import { writeFileSync, existsSync, readFileSync } from "fs";

const BATCH_SIZE = 5;
const CHECKPOINT_FILE = "checkpoint-pusher.json";

export async function push(
  input: AsyncQueue<XhsNote>,
  errors: ScrapeError[],
  apiUrl: string,
  token?: string,
) {
  const pushed = loadCheckpoint();
  let ingested = 0;
  let skipped = 0;
  let batch: XhsNote[] = [];

  for await (const note of input) {
    if (pushed.has(note.noteId)) {
      skipped++;
      continue;
    }
    batch.push(note);

    if (batch.length >= BATCH_SIZE) {
      const result = await pushBatch(batch, apiUrl, token, errors);
      ingested += result;
      for (const n of batch) pushed.add(n.noteId);
      saveCheckpoint(pushed);
      batch = [];

      if (ingested % 20 === 0 || ingested <= 10) {
        console.log(`[pusher] ${ingested} ingested, ${skipped} skipped`);
      }
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    const result = await pushBatch(batch, apiUrl, token, errors);
    ingested += result;
    for (const n of batch) pushed.add(n.noteId);
    saveCheckpoint(pushed);
  }

  console.log(`[pusher] Done. ${ingested} ingested, ${skipped} already pushed.`);
}

async function pushBatch(
  notes: XhsNote[],
  apiUrl: string,
  token: string | undefined,
  errors: ScrapeError[],
): Promise<number> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`${apiUrl}/api/sync/trigger`, {
      method: "POST",
      headers,
      body: JSON.stringify({ notes, platform: "xiaohongshu" }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      for (const n of notes) {
        errors.push({
          noteId: n.noteId,
          href: n.sourceUrl,
          stage: "pusher",
          reason: "api_error",
          message: JSON.stringify(err).slice(0, 100),
        });
      }
      return 0;
    }

    const data = await res.json() as { ingested: number };
    return data.ingested;
  } catch (err) {
    for (const n of notes) {
      errors.push({
        noteId: n.noteId,
        href: n.sourceUrl,
        stage: "pusher",
        reason: "api_error",
        message: (err as Error).message?.slice(0, 100),
      });
    }
    return 0;
  }
}

function loadCheckpoint(): Set<string> {
  if (!existsSync(CHECKPOINT_FILE)) return new Set();
  try {
    return new Set(JSON.parse(readFileSync(CHECKPOINT_FILE, "utf-8")));
  } catch {
    return new Set();
  }
}

function saveCheckpoint(pushed: Set<string>) {
  writeFileSync(CHECKPOINT_FILE, JSON.stringify([...pushed]));
}
