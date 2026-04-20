import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

const isServerless = !!process.env.VERCEL;

async function createServerlessClient() {
  const { neon } = await import("@neondatabase/serverless");
  const { PrismaNeonHttp } = await import("@prisma/adapter-neon");
  const sql = neon(env.DATABASE_URL);
  const adapter = new PrismaNeonHttp(sql);
  return new PrismaClient({ adapter } as never);
}

async function createLocalClient() {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const pg = await import("pg");
  const pool = new pg.default.Pool({ connectionString: env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter } as never);
}

const clientPromise = isServerless ? createServerlessClient() : createLocalClient();

export const db = await clientPromise;
