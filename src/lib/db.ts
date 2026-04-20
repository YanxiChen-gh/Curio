import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

function createClient() {
  if (process.env.VERCEL) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaNeonHttp } = require("@prisma/adapter-neon");
    const adapter = new PrismaNeonHttp(env.DATABASE_URL, {
      arrayMode: false,
      fullResults: true,
    });
    return new PrismaClient({ adapter } as never);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require("@prisma/adapter-pg");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pg = require("pg");
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter } as never);
}

export const db = createClient();
