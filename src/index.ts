import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./lib/env.js";
import auth from "./routes/auth.js";
import health from "./routes/health.js";
import notes from "./routes/notes.js";
import chat from "./routes/chat.js";
import sessions from "./routes/sessions.js";
import syncRoute from "./routes/syncRoute.js";

const app = new Hono();

app.use("*", cors());

app.get("/", (c) =>
  c.json({
    name: "Curio 拾趣",
    description: "Personal knowledge assistant for your saved posts",
    version: "0.1.0",
  }),
);

app.route("/", auth);
app.route("/", health);
app.route("/", notes);
app.route("/", chat);
app.route("/", sessions);
app.route("/", syncRoute);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`🔮 Curio running at http://localhost:${info.port}`);
});

export default app;
