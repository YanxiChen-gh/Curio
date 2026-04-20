import { fetchUserFeed, searchNotes } from "./opencli.js";
import { ingestNotes } from "./sync.js";

const command = process.argv[2];
const query = process.argv[3];

async function main() {
  if (command === "feed") {
    console.log("Fetching feed...");
    const notes = await fetchUserFeed(20);
    console.log(`Found ${notes.length} notes from feed`);
    const count = await ingestNotes(notes);
    console.log(`Ingested ${count} new notes`);
  } else if (command === "search" && query) {
    console.log(`Searching for: ${query}`);
    const notes = await searchNotes(query, 20);
    console.log(`Found ${notes.length} notes`);
    const count = await ingestNotes(notes);
    console.log(`Ingested ${count} new notes`);
  } else {
    console.log("Usage:");
    console.log("  npm run ingest feed           # Ingest from your XHS feed");
    console.log('  npm run ingest search "ramen"  # Search and ingest');
  }
}

main().catch(console.error).finally(() => process.exit());
