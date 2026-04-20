import { clerkMiddleware, getAuth } from "@clerk/hono";
import type { Context, Next } from "hono";
import { db } from "./db.js";
import type { AppVariables } from "../types/context.js";

export { clerkMiddleware };

const DEV_BYPASS = process.env.DEV_AUTH_BYPASS === "true";

export async function authMiddleware(c: Context<{ Variables: AppVariables }>, next: Next) {
  if (DEV_BYPASS) {
    const devEmail = process.env.DEV_USER_EMAIL || "dev@curio.app";
    let user = await db.user.findFirst({ where: { email: devEmail } });
    if (!user) {
      user = await db.user.findFirst();
    }
    if (!user) {
      user = await db.user.create({
        data: { clerkId: "dev_user", email: devEmail, name: "Dev User" },
      });
    }
    c.set("userId", user.id);
    return next();
  }

  const auth = getAuth(c);

  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const clerkId = auth.userId;
  const email = (auth.sessionClaims?.email as string) || "";

  let user = await db.user.findUnique({ where: { clerkId } });
  if (!user && email) {
    user = await db.user.findFirst({ where: { email } });
    if (user) {
      user = await db.user.update({
        where: { id: user.id },
        data: { clerkId },
      });
    }
  }
  if (!user) {
    user = await db.user.create({
      data: {
        clerkId,
        email,
        name: (auth.sessionClaims?.name as string) || email.split("@")[0],
      },
    });
  }

  c.set("userId", user.id);
  await next();
}
