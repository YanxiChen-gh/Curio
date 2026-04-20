import jwt from "jsonwebtoken";
import type { Context, Next } from "hono";
import type { AppVariables } from "../types/context.js";
import { env } from "./env.js";
import { db } from "./db.js";

export function signToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): { userId: string } {
  return jwt.verify(token, env.JWT_SECRET) as { userId: string };
}

export async function authMiddleware(c: Context<{ Variables: AppVariables }>, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { userId } = verifyToken(header.slice(7));
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return c.json({ error: "User not found" }, 401);
    c.set("userId", userId);
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
}

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
): Promise<GoogleUserInfo> {
  console.log("[auth] Exchanging code, redirect:", redirectUri);

  const controller1 = new AbortController();
  const timeout1 = setTimeout(() => controller1.abort(), 8000);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    signal: controller1.signal,
  });
  clearTimeout(timeout1);

  console.log("[auth] Token response status:", tokenRes.status);

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google token exchange failed (${tokenRes.status}): ${err}`);
  }

  const tokens: GoogleTokenResponse = await tokenRes.json();
  console.log("[auth] Got access token, fetching user info");

  const controller2 = new AbortController();
  const timeout2 = setTimeout(() => controller2.abort(), 8000);

  const userRes = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: controller2.signal,
    },
  );
  clearTimeout(timeout2);

  if (!userRes.ok) throw new Error("Failed to fetch Google user info");
  return userRes.json();
}
