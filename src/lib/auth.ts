import { clerkMiddleware, getAuth } from "@clerk/hono";
import type { Context, Next } from "hono";
import { db } from "./db.js";
import type { AppVariables } from "../types/context.js";

export { clerkMiddleware };

const DEV_BYPASS = process.env.DEV_AUTH_BYPASS === "true";

export async function authMiddleware(c: Context<{ Variables: AppVariables }>, next: Next) {
  if (DEV_BYPASS) {
    let user = await db.user.findFirst();
    if (!user) {
      user = await db.user.create({
        data: { clerkId: "dev_user", email: "dev@curio.app", name: "Dev User" },
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

  let user = await db.user.findUnique({ where: { clerkId } });
  if (!user) {
    user = await db.user.create({
      data: {
        clerkId,
        email: auth.sessionClaims?.email as string || "",
        name: (auth.sessionClaims?.name as string) || (auth.sessionClaims?.email as string) || "",
      },
    });
  }

  c.set("userId", user.id);
  await next();
}
