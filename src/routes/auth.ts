import { Hono } from "hono";
import { db } from "../lib/db.js";
import { env } from "../lib/env.js";
import { signToken, verifyToken, exchangeGoogleCode } from "../lib/auth.js";

const app = new Hono();

app.get("/api/auth/google/url", (c) => {
  const redirectUri = c.req.query("redirect_uri") || "http://localhost:5173/auth/callback";
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return c.json({ url: url.toString() });
});

app.post("/api/auth/google/callback", async (c) => {
  const { code, redirect_uri } = await c.req.json<{
    code: string;
    redirect_uri?: string;
  }>();

  if (!code) return c.json({ error: "Missing code" }, 400);

  const redirectUri = redirect_uri || "http://localhost:5173/auth/callback";
  const googleUser = await exchangeGoogleCode(code, redirectUri);

  let user = await db.user.findUnique({
    where: { googleId: googleUser.sub },
  });

  if (!user) {
    user = await db.user.findUnique({ where: { email: googleUser.email } });
    if (user) {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          googleId: googleUser.sub,
          name: user.name || googleUser.name,
          avatarUrl: googleUser.picture,
        },
      });
    } else {
      user = await db.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          avatarUrl: googleUser.picture,
          googleId: googleUser.sub,
        },
      });
    }
  }

  const token = signToken(user.id);
  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
  });
});

app.get("/api/auth/me", async (c) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { userId } = verifyToken(header.slice(7));
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
    if (!user) return c.json({ error: "User not found" }, 401);
    return c.json({ user });
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
});

export default app;
