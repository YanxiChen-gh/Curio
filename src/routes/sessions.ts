import { Hono } from "hono";
import { db } from "../lib/db.js";
import { authMiddleware } from "../lib/auth.js";
import type { AppVariables } from "../types/context.js";

const app = new Hono<{ Variables: AppVariables }>();

app.use("/api/sessions/*", authMiddleware);
app.use("/api/sessions", authMiddleware);

app.get("/api/sessions", async (c) => {
  const userId = c.get("userId") as string;
  const sessions = await db.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });
  return c.json({ sessions });
});

app.post("/api/sessions", async (c) => {
  const userId = c.get("userId") as string;
  const session = await db.chatSession.create({
    data: { userId },
  });
  return c.json({ session });
});

app.get("/api/sessions/:id/messages", async (c) => {
  const userId = c.get("userId") as string;
  const sessionId = c.req.param("id");

  const session = await db.chatSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) return c.json({ error: "Session not found" }, 404);

  const messages = await db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, createdAt: true },
  });
  return c.json({ session, messages });
});

app.delete("/api/sessions/:id", async (c) => {
  const userId = c.get("userId") as string;
  const sessionId = c.req.param("id");

  const session = await db.chatSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) return c.json({ error: "Session not found" }, 404);

  await db.chatSession.delete({ where: { id: sessionId } });
  return c.json({ ok: true });
});

export default app;
