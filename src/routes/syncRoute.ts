import { Hono } from "hono";
import { ingestNotes } from "../ingestion/sync.js";
import { authMiddleware } from "../lib/auth.js";
import type { XhsNote } from "../types/xhs.js";

const app = new Hono();

app.use("/api/sync/*", authMiddleware);

app.post("/api/sync/trigger", async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json<{
    notes: XhsNote[];
    platform?: string;
  }>().catch(() => null);

  if (!body?.notes?.length) {
    return c.json(
      { error: "Provide { notes: XhsNote[] } in request body" },
      400,
    );
  }

  const count = await ingestNotes(body.notes, body.platform || "xiaohongshu", userId);
  return c.json({ ingested: count, total: body.notes.length });
});

export default app;
