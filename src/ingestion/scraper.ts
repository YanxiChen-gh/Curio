import { chromium, type BrowserContext, type Page } from "playwright";
import type { XhsNote } from "../types/xhs.js";
import { describeImages } from "../lib/vision.js";
import { resolve } from "path";
import { existsSync, writeFileSync } from "fs";

export interface ScrapeError {
  noteId: string;
  href: string;
  reason: "login_wall" | "timeout" | "no_content" | "error";
  message?: string;
}

export interface ScrapeResult {
  notes: XhsNote[];
  errors: ScrapeError[];
}

const CDP_URL = process.env.CHROME_CDP_URL;
const SESSION_FILE = process.env.XHS_SESSION_FILE || resolve(process.cwd(), "xhs-session.json");

export async function fetchSavedNotes(
  userId: string,
  maxNotes = 100,
  onNote?: (note: XhsNote, index: number, total: number) => Promise<void>,
): Promise<ScrapeResult> {
  let browser;
  let context: BrowserContext;
  let page: Page;
  let shouldClose = false;

  if (CDP_URL) {
    console.log(`[scraper] Connecting to Chrome via CDP: ${CDP_URL}`);
    browser = await chromium.connectOverCDP(CDP_URL);
    context = browser.contexts()[0];
    page = await context.newPage();
  } else {
    console.log(`[scraper] Launching headless Chromium with session: ${SESSION_FILE}`);
    if (!existsSync(SESSION_FILE)) {
      throw new Error(`Session file not found at ${SESSION_FILE}. Run: npm run save-cookies (with debug Chrome open + logged into rednote.com)`);
    }
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled"],
    });
    context = await browser.newContext({
      storageState: SESSION_FILE,
      viewport: { width: 1920, height: 1080 },
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    });
    page = await context.newPage();
    shouldClose = true;
  }

  try {
    console.log(`[scraper] Opening profile...`);
    await page.goto(`https://www.rednote.com/user/profile/${userId}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForTimeout(3000);

    console.log(`[scraper] Clicking saved/收藏 tab...`);
    const collectTab = page.locator(".reds-tab-item", { hasText: /收藏|Save/ }).first();
    await collectTab.click();
    await page.waitForTimeout(3000);

    // Wait for collect tab content to load
    await page.waitForSelector('.tab-content-item:nth-child(2) a[href*="xsec_token"]', { timeout: 10_000 }).catch(() => {
      console.log("[scraper] Warning: No saved note links found after clicking tab. Retrying...");
    });
    await page.waitForTimeout(1000);

    // Scroll to collect note links with xsec_tokens
    const noteLinks = new Map<string, string>();
    let staleRounds = 0;
    let lastCount = 0;

    while (noteLinks.size < maxNotes && staleRounds < 5) {
      const found = await page.$$eval(
        '.tab-content-item:nth-child(2) a[href*="xsec_token"][href*="pc_collect"]',
        (els) =>
          els
            .map((el) => {
              const href = el.getAttribute("href") || "";
              const match = href.match(/\/([a-f0-9]{24})\?/);
              if (!match) return null;
              return {
                id: match[1],
                href: href.startsWith("http") ? href : `https://www.rednote.com${href}`,
              };
            })
            .filter(Boolean) as Array<{ id: string; href: string }>,
      );

      for (const f of found) {
        if (!noteLinks.has(f.id)) noteLinks.set(f.id, f.href);
      }

      if (noteLinks.size === lastCount) {
        staleRounds++;
      } else {
        console.log(`[scraper] Found ${noteLinks.size} saved notes...`);
        staleRounds = 0;
        lastCount = noteLinks.size;
      }

      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(1500);
    }

    const entries = [...noteLinks.entries()].slice(0, maxNotes);
    console.log(`[scraper] Fetching ${entries.length} notes...`);

    const notes: XhsNote[] = [];
    const errors: ScrapeError[] = [];

    for (let i = 0; i < entries.length; i++) {
      const [noteId, href] = entries[i];
      try {
        await page.goto(href, { waitUntil: "domcontentloaded", timeout: 15_000 });
        await page.waitForTimeout(2000);

        const isLoginWall = await page.evaluate(() =>
          document.body.innerText.includes("Log in with phone") ||
          document.body.innerText.includes("登录") && document.body.innerText.includes("手机号"),
        );

        if (isLoginWall) {
          errors.push({ noteId, href, reason: "login_wall" });
          continue;
        }

        const note = await extractNote(page, context, noteId);
        if (note && note.title && !note.title.includes("Sorry")) {
          notes.push(note);
          if (notes.length % 10 === 0 || notes.length <= 5) {
            console.log(`[scraper] ${notes.length} scraped (${i + 1}/${entries.length}): ${note.title.slice(0, 50)}`);
          }

          if (onNote) await onNote(note, notes.length, entries.length);
        } else {
          errors.push({ noteId, href, reason: "no_content" });
        }

        if (i % 10 === 9) {
          await page.waitForTimeout(2000);
        }
      } catch (err) {
        const msg = (err as Error).message?.slice(0, 100) || "unknown";
        errors.push({ noteId, href, reason: msg.includes("Timeout") ? "timeout" : "error", message: msg });
      }
    }

    const loginWalls = errors.filter((e) => e.reason === "login_wall").length;
    console.log(`[scraper] Done. ${notes.length} scraped, ${loginWalls} login walls, ${errors.length - loginWalls} other errors.`);

    // Save errors for retry
    const errFile = resolve(process.cwd(), "scrape-errors.json");
    writeFileSync(errFile, JSON.stringify(errors, null, 2));
    if (errors.length > 0) {
      console.log(`[scraper] ${errors.length} errors saved to scrape-errors.json for retry.`);
    }

    return { notes, errors };
  } finally {
    await page.close();
    if (shouldClose) await context.close();
  }
}

async function extractNote(
  page: Page,
  context: BrowserContext,
  noteId: string,
): Promise<XhsNote | null> {
  const title = await page
    .$eval("#detail-title, [class*='note-title'], .title", (el) => el.textContent?.trim() || "")
    .catch(() => "");

  const content = await page
    .$eval("#detail-desc, [class*='note-text'], [class*='desc']", (el) => el.textContent?.trim() || "")
    .catch(() => "");

  let author = await page
    .$eval("[class*='username'], [class*='author'], [class*='nick']", (el) => el.textContent?.trim() || "")
    .catch(() => "");
  author = author.replace(/关注$/, "").trim();

  const location = await page
    .$eval("[class*='location'], [class*='ip-location']", (el) => el.textContent?.trim() || "")
    .catch(() => "");

  const publishedAt = await page
    .$eval("[class*='date'], [class*='time'], [class*='publish']", (el) => el.textContent?.trim() || "")
    .catch(() => "");

  const tags = await page
    .$$eval("a[class*='tag'], #hash-tag a", (els) =>
      els.map((el) => (el.textContent || "").replace(/^#/, "").trim()).filter(Boolean),
    )
    .catch(() => [] as string[]);

  const hashTags = (content.match(/#([^\s#]+)/g) || []).map((t) => t.slice(1));
  for (const t of hashTags) {
    if (!tags.includes(t)) tags.push(t);
  }

  // Collect image URLs
  let imageUrls = await page
    .$$eval("img[src*='rednotecdn']", (els) =>
      [...new Set(els.map((el) => (el as HTMLImageElement).src).filter((u) => !u.includes("avatar") && (el => el.width > 100)(el as any)))],
    )
    .catch(() => [] as string[]);

  // Simpler fallback
  if (imageUrls.length === 0) {
    imageUrls = await page
      .$$eval("img", (els) =>
        [...new Set(
          els
            .filter((el) => el.width > 100 && el.src.includes("rednotecdn") && !el.src.includes("avatar"))
            .map((el) => el.src),
        )],
      )
      .catch(() => [] as string[]);
  }

  // For video posts, take a screenshot of the player as a thumbnail
  const hasVideo = await page.$("video").catch(() => null);
  if (hasVideo && imageUrls.length === 0) {
    try {
      const player = await page.$("[class*='player-container'], [class*='video-player']");
      if (player) {
        const screenshot = await player.screenshot({ type: "jpeg", quality: 80 });
        const base64 = screenshot.toString("base64");
        imageUrls.push(`data:image/jpeg;base64,${base64}`);
      }
    } catch {}
  }

  // Download images and run vision to get descriptions
  const downloadedBase64: string[] = [];
  for (const url of imageUrls.slice(0, 5)) {
    if (url.startsWith("data:")) {
      downloadedBase64.push(url);
      continue;
    }
    try {
      const resp = await context.request.get(url);
      if (resp.ok()) {
        const body = await resp.body();
        const contentType = resp.headers()["content-type"] || "image/webp";
        downloadedBase64.push(`data:${contentType};base64,${body.toString("base64")}`);
      }
    } catch {}
  }

  // Run vision on images and append descriptions to content
  let enrichedContent = content;
  if (downloadedBase64.length > 0) {
    try {
      const descriptions = await describeImages(downloadedBase64, title);
      if (descriptions.length === downloadedBase64.length) {
        const descText = descriptions.map((d, i) => `[图片${i + 1}]: ${d}`).join("\n\n");
        enrichedContent = content + "\n\n" + descText;
      } else if (descriptions.length === 1) {
        enrichedContent = content + "\n\n[图片描述]: " + descriptions[0];
      }
    } catch {}
  }

  if (!title && !enrichedContent) return null;

  return {
    noteId,
    title,
    content: enrichedContent,
    author: author || undefined,
    tags,
    location: location || undefined,
    imageUrls: [],
    sourceUrl: `xhsdiscover://item/${noteId}`,
    publishedAt: publishedAt || undefined,
  };
}
