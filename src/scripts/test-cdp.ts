import { chromium } from "playwright";

async function main() {
  console.log("Connecting to Chrome...");
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const contexts = browser.contexts();
  console.log("Contexts:", contexts.length);
  const pages = contexts[0]?.pages() || [];
  console.log("Open pages:", pages.length);
  for (const p of pages) console.log(" -", p.url());

  console.log("\nOpening xiaohongshu.com...");
  const page = await contexts[0].newPage();
  await page.goto("https://www.xiaohongshu.com", { timeout: 15_000 });
  console.log("Page title:", await page.title());
  console.log("URL:", page.url());
  await page.close();
}

main().catch(console.error).finally(() => process.exit());
