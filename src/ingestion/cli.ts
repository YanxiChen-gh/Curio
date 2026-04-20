import { runPipeline, retryErrors, showStatus } from "./pipeline.js";

const args = process.argv.slice(2);
const command = args[0];

let userId = "";
let maxNotes = 50;
let token = process.env.CURIO_TOKEN || "";
let apiUrl = "http://localhost:3000";
let resume = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--user" && args[i + 1]) userId = args[i + 1];
  if (args[i] === "--max" && args[i + 1]) maxNotes = Number(args[i + 1]);
  if (args[i] === "--token" && args[i + 1]) token = args[i + 1];
  if (args[i] === "--api" && args[i + 1]) apiUrl = args[i + 1];
  if (args[i] === "--resume") resume = true;
}

async function main() {
  if (command === "saved") {
    if (!userId) {
      console.error("Error: --user <xhs-user-id> is required");
      process.exit(1);
    }
    console.log(`Curio Ingestion Pipeline`);
    console.log(`User: ${userId} | Max: ${maxNotes} | API: ${apiUrl} | Resume: ${resume}\n`);

    await runPipeline({ userId, maxNotes, apiUrl, token, resume });

  } else if (command === "retry") {
    console.log("Curio Retry Pipeline\n");
    await retryErrors(apiUrl, token);

  } else if (command === "resume") {
    if (!userId) {
      console.error("Error: --user <xhs-user-id> is required for resume");
      process.exit(1);
    }
    console.log(`Curio Resume Pipeline`);
    console.log(`User: ${userId} | Max: ${maxNotes} | API: ${apiUrl}\n`);

    await runPipeline({ userId, maxNotes, apiUrl, token, resume: true });

  } else if (command === "status") {
    showStatus();

  } else {
    console.log("Curio Ingestion CLI");
    console.log("");
    console.log("Commands:");
    console.log("  npm run ingest saved -- --user <id> [--max N]     Scrape saved posts");
    console.log("  npm run ingest retry                              Retry failed notes");
    console.log("  npm run ingest resume -- --user <id>              Resume from checkpoint");
    console.log("  npm run ingest status                             Show pipeline status");
    console.log("");
    console.log("Options:");
    console.log("  --user <id>      XHS user ID (from profile URL)");
    console.log("  --max <n>        Max notes to fetch (default: 50)");
    console.log("  --token <jwt>    Auth token (or set CURIO_TOKEN env var)");
    console.log("  --api <url>      API URL (default: http://localhost:3000)");
    console.log("");
    console.log("Setup:");
    console.log("  1. Save cookies: start Chrome with --remote-debugging-port=9222");
    console.log("     --user-data-dir=$HOME/chrome-debug-profile, log into rednote.com,");
    console.log("     then run: npx tsx src/scripts/save-cookies.ts");
    console.log("  2. Start backend: npm run dev");
    console.log("  3. Run: npm run ingest saved -- --user <id> --max 100");
  }
}

main().catch(console.error).finally(() => process.exit());
