import { Hono } from "hono";
import { db } from "../lib/db.js";
import { authMiddleware } from "../lib/auth.js";
import type { AppVariables } from "../types/context.js";

const app = new Hono<{ Variables: AppVariables }>();

app.use("/api/notes", authMiddleware);

app.get("/api/notes", async (c) => {
  const userId = c.get("userId") as string;
  const limit = Number(c.req.query("limit") || 50);
  const offset = Number(c.req.query("offset") || 0);

  const [notes, total] = await Promise.all([
    db.note.findMany({
      where: { userId },
      orderBy: { syncedAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        externalId: true,
        platform: true,
        title: true,
        content: true,
        author: true,
        tags: true,
        location: true,
        sourceUrl: true,
        syncedAt: true,
      },
    }),
    db.note.count({ where: { userId } }),
  ]);

  return c.json({ notes, total, limit, offset });
});

export default app;
