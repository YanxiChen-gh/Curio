import { fetchSavedNotes } from "./scraper.js";
import type { XhsNote } from "../types/xhs.js";

const args = process.argv.slice(2);
const command = args[0];

let userId = "";
let maxNotes = 50;
let token = process.env.CURIO_TOKEN || "";
let apiUrl = "http://localhost:3000";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--user" && args[i + 1]) userId = args[i + 1];
  if (args[i] === "--max" && args[i + 1]) maxNotes = Number(args[i + 1]);
  if (args[i] === "--token" && args[i + 1]) token = args[i + 1];
  if (args[i] === "--api" && args[i + 1]) apiUrl = args[i + 1];
}

async function pushToApi(notes: XhsNote[], platform = "xiaohongshu") {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiUrl}/api/sync/trigger`, {
    method: "POST",
    headers,
    body: JSON.stringify({ notes, platform }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`API error (${res.status}): ${JSON.stringify(err)}`);
  }

  return res.json() as Promise<{ ingested: number; total: number }>;
}

async function main() {
  if (command === "saved") {
    if (!userId) {
      console.error("Error: --user <xhs-user-id> is required");
      console.error("Find it in your profile URL: rednote.com/user/profile/<this-part>");
      process.exit(1);
    }

    console.log(`Scraping saved posts for user ${userId} (max ${maxNotes})...`);
    console.log(`Chrome CDP: ${process.env.CHROME_CDP_URL || "http://localhost:9222"}`);
    console.log(`API: ${apiUrl}\n`);

    const notes = await fetchSavedNotes(userId, maxNotes);
    console.log(`\nScraped ${notes.length} notes. Pushing to API...`);

    if (notes.length === 0) {
      console.log("No notes to ingest.");
      return;
    }

    // Push in batches of 5 to avoid overwhelming the embedding API
    const batchSize = 5;
    let totalIngested = 0;
    for (let i = 0; i < notes.length; i += batchSize) {
      const batch = notes.slice(i, i + batchSize);
      const result = await pushToApi(batch);
      totalIngested += result.ingested;
      console.log(`Batch ${Math.floor(i / batchSize) + 1}: ingested ${result.ingested} new notes`);
    }

    console.log(`\nDone! Ingested ${totalIngested} new notes.`);
  } else {
    console.log("Curio Ingestion CLI");
    console.log("");
    console.log("Usage:");
    console.log("  npm run ingest saved -- --user <xhs-user-id> [options]");
    console.log("");
    console.log("Options:");
    console.log("  --user <id>      XHS user ID (from profile URL)");
    console.log("  --max <n>        Max notes to fetch (default: 50)");
    console.log("  --token <jwt>    Auth token (or set CURIO_TOKEN env var)");
    console.log("  --api <url>      API URL (default: http://localhost:3000)");
    console.log("");
    console.log("Prerequisites:");
    console.log("  1. Chrome running with: --remote-debugging-port=9222 --user-data-dir=$HOME/chrome-debug-profile");
    console.log("  2. Logged into xiaohongshu/rednote in that Chrome");
    console.log("  3. Backend running (npm run dev)");
  }
}

main().catch(console.error).finally(() => process.exit());
