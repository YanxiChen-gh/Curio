import { chromium } from "playwright";
import { writeFileSync } from "fs";

async function main() {
  const cdpUrl = process.env.CHROME_CDP_URL || "http://localhost:9222";
  console.log(`Connecting to Chrome at ${cdpUrl}...`);
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0];
  const state = await context.storageState();
  writeFileSync("xhs-session.json", JSON.stringify(state, null, 2));
  console.log(`Saved ${state.cookies.length} cookies to xhs-session.json`);
}

main().catch(console.error).finally(() => process.exit());
