import { serve } from "@hono/node-server";
import { env } from "./lib/env.js";
import app from "./app.js";

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`🔮 Curio running at http://localhost:${info.port}`);
});
