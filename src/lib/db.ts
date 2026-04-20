import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { env } from "./env.js";

function createClient() {
  if (process.env.VERCEL) {
    const adapter = new PrismaNeonHttp(env.DATABASE_URL, {
      arrayMode: false,
      fullResults: true,
    });
    return new PrismaClient({ adapter } as never);
  }

  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter } as never);
}

export const db = createClient();
