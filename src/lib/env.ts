import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  DATABASE_URL: z.string(),
  OPENAI_API_KEY: z.string(),
  JWT_SECRET: z.string().default("curio-dev-secret-change-in-prod"),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  PORT: z.coerce.number().default(3000),
});

export const env = envSchema.parse(process.env);
