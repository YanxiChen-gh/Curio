import { db } from "../lib/db.js";

async function main() {
  const users = await db.user.findMany({
    select: { id: true, email: true, clerkId: true, _count: { select: { notes: true } } },
  });
  console.log("Users:");
  users.forEach((u) => console.log(`  ${u.email} (${u.id}) clerkId=${u.clerkId} notes=${u._count.notes}`));

  const notes = await db.note.findMany({
    take: 3,
    orderBy: { syncedAt: "desc" },
    select: { title: true, userId: true },
  });
  console.log("\nLatest 3 notes:");
  notes.forEach((n) => console.log(`  "${n.title.slice(0, 40)}" -> userId=${n.userId}`));
}

main().catch(console.error).finally(() => process.exit());
