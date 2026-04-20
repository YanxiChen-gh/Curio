import { chromium, type BrowserContext, type Page } from "playwright";
import type { XhsNote } from "../types/xhs.js";

const CDP_URL = process.env.CHROME_CDP_URL || "http://localhost:9222";

export async function fetchSavedNotes(
  userId: string,
  maxNotes = 100,
  onNote?: (note: XhsNote, index: number, total: number) => Promise<void>,
): Promise<XhsNote[]> {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  const page = await context.newPage();

  try {
    console.log(`[scraper] Opening profile...`);
    await page.goto(`https://www.rednote.com/user/profile/${userId}`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await page.waitForTimeout(2000);

    console.log(`[scraper] Clicking 收藏 tab...`);
    await page.locator(".reds-tab-item", { hasText: "收藏" }).first().click();
    await page.waitForTimeout(2000);

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

    for (let i = 0; i < entries.length; i++) {
      const [noteId, href] = entries[i];
      try {
        await page.goto(href, { waitUntil: "domcontentloaded", timeout: 15_000 });
        await page.waitForTimeout(2000);

        const note = await extractNote(page, context, noteId);
        if (note && note.title && !note.title.includes("Sorry")) {
          notes.push(note);
          console.log(`[scraper] ${notes.length}/${entries.length}: ${note.title.slice(0, 50)}`);

          if (onNote) await onNote(note, notes.length, entries.length);
        }
      } catch (err) {
        console.error(`[scraper] Failed ${noteId}:`, (err as Error).message?.slice(0, 80));
      }
    }

    return notes;
  } finally {
    await page.close();
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

  // Download images through browser context for vision pipeline
  const downloadedUrls: string[] = [];
  for (const url of imageUrls.slice(0, 5)) {
    if (url.startsWith("data:")) {
      downloadedUrls.push(url);
      continue;
    }
    try {
      const resp = await context.request.get(url);
      if (resp.ok()) {
        const body = await resp.body();
        const contentType = resp.headers()["content-type"] || "image/webp";
        downloadedUrls.push(`data:${contentType};base64,${body.toString("base64")}`);
      }
    } catch {}
  }

  if (!title && !content) return null;

  return {
    noteId,
    title,
    content,
    author: author || undefined,
    tags,
    location: location || undefined,
    imageUrls: downloadedUrls,
    sourceUrl: `https://www.rednote.com/explore/${noteId}`,
  };
}
