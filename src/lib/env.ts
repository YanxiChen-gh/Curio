import { z } from "zod";
import { config } from "dotenv";

if (!process.env.VERCEL) {
  config();
}

const envSchema = z.object({
  DATABASE_URL: z.string(),
  OPENAI_API_KEY: z.string(),
  CLERK_PUBLISHABLE_KEY: z.string(),
  CLERK_SECRET_KEY: z.string(),
  PORT: z.coerce.number().default(3000),
});

export const env = envSchema.parse(process.env);
