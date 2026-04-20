import { Hono } from "hono";
import { getAuth } from "@clerk/hono";
import { db } from "../lib/db.js";

const app = new Hono();

app.get("/api/auth/me", async (c) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await db.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ user });
});

export default app;
