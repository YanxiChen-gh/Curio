import { fetchUserFeed, searchNotes } from "./opencli.js";
import type { XhsNote } from "../types/xhs.js";

const args = process.argv.slice(2);
const command = args[0];
const query = args[1];

let token = "";
let apiUrl = "http://localhost:3000";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--token" && args[i + 1]) token = args[i + 1];
  if (args[i] === "--api" && args[i + 1]) apiUrl = args[i + 1];
}

if (!token) {
  token = process.env.CURIO_TOKEN || "";
}

async function pushToApi(notes: XhsNote[], platform = "xiaohongshu") {
  if (!token) {
    console.error("Error: No auth token. Provide --token <jwt> or set CURIO_TOKEN env var.");
    console.error("Get your token: log in at the web app, then run in browser console:");
    console.error('  localStorage.getItem("curio_token")');
    process.exit(1);
  }

  const res = await fetch(`${apiUrl}/api/sync/trigger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ notes, platform }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    console.error(`API error (${res.status}):`, err);
    process.exit(1);
  }

  return res.json() as Promise<{ ingested: number; total: number }>;
}

async function main() {
  if (command === "feed") {
    console.log(`Fetching feed from XHS...`);
    console.log(`API: ${apiUrl}`);
    const notes = await fetchUserFeed(20);
    console.log(`Found ${notes.length} notes`);
    const result = await pushToApi(notes);
    console.log(`Ingested ${result.ingested} new notes (${result.total} total)`);
  } else if (command === "search" && query) {
    console.log(`Searching XHS for: ${query}`);
    console.log(`API: ${apiUrl}`);
    const notes = await searchNotes(query, 20);
    console.log(`Found ${notes.length} notes`);
    const result = await pushToApi(notes);
    console.log(`Ingested ${result.ingested} new notes (${result.total} total)`);
  } else {
    console.log("Curio Ingestion CLI");
    console.log("");
    console.log("Usage:");
    console.log("  npm run ingest feed    -- --token <jwt>   # Ingest from your XHS feed");
    console.log('  npm run ingest search "ramen" -- --token <jwt>  # Search and ingest');
    console.log("");
    console.log("Options:");
    console.log("  --token <jwt>    Auth token (or set CURIO_TOKEN env var)");
    console.log("  --api <url>      API URL (default: http://localhost:3000)");
    console.log("");
    console.log("Get your token: log in at the web app, then in browser console:");
    console.log('  localStorage.getItem("curio_token")');
  }
}

main().catch(console.error).finally(() => process.exit());
