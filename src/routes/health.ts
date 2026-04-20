import { Hono } from "hono";
import { db } from "../lib/db.js";

const app = new Hono();

app.get("/health", async (c) => {
  try {
    await db.$queryRaw`SELECT 1`;
    const noteCount = await db.note.count();
    const chunkCount = await db.chunk.count();
    return c.json({
      status: "ok",
      db: "connected",
      notes: noteCount,
      chunks: chunkCount,
    });
  } catch {
    return c.json({ status: "error", db: "disconnected" }, 500);
  }
});

export default app;
