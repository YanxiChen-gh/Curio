import { Hono } from "hono";
import { ingestNotes } from "../ingestion/sync.js";
import { authMiddleware } from "../lib/auth.js";
import type { AppVariables } from "../types/context.js";
import type { XhsNote } from "../types/xhs.js";

const app = new Hono<{ Variables: AppVariables }>();

app.use("/api/sync/*", authMiddleware);

app.post("/api/sync/trigger", async (c) => {
  const userId = c.get("userId") as string;

  let body: { notes: XhsNote[]; platform?: string } | null = null;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body?.notes?.length) {
    return c.json(
      { error: "Provide { notes: XhsNote[] } in request body" },
      400,
    );
  }

  const platform = body.platform || "xiaohongshu";
  let ingested = 0;
  let skipped = 0;
  let failed = 0;

  for (const note of body.notes) {
    try {
      const count = await ingestNotes([note], platform, userId);
      if (count > 0) {
        ingested++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[sync] Failed to ingest ${note.noteId}:`, (err as Error).message?.slice(0, 100));
      failed++;
    }
  }

  return c.json({
    ingested,
    skipped,
    failed,
    total: body.notes.length,
  });
});

export default app;
