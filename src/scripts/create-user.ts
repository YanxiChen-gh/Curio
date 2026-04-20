import { db } from "../lib/db.js";

const email = process.argv[2] || "teresaliu1212@gmail.com";

async function main() {
  const user = await db.user.upsert({
    where: { clerkId: `manual_${email}` },
    update: {},
    create: {
      clerkId: `manual_${email}`,
      email,
      name: email.split("@")[0],
    },
  });
  console.log(`User: ${user.id} (${user.email})`);
}

main().catch(console.error).finally(() => process.exit());
