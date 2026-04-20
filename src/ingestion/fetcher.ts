import type { BrowserContext, Page } from "playwright";
import type { NoteRef, RawNote, ScrapeError } from "./types.js";
import { AsyncQueue } from "./queue.js";

export async function fetch(
  page: Page,
  context: BrowserContext,
  input: AsyncQueue<NoteRef>,
  output: AsyncQueue<RawNote>,
  errors: ScrapeError[],
) {
  let processed = 0;
  let succeeded = 0;

  for await (const ref of input) {
    processed++;
    try {
      await page.goto(ref.href, { waitUntil: "domcontentloaded", timeout: 15_000 });
      await page.waitForTimeout(1500);

      const isLoginWall = await page.evaluate(() =>
        document.body.innerText.includes("Log in with phone") ||
        (document.body.innerText.includes("登录") && document.body.innerText.includes("手机号")),
      );

      if (isLoginWall) {
        errors.push({ noteId: ref.noteId, href: ref.href, stage: "fetcher", reason: "login_wall" });
        continue;
      }

      const raw = await extractRaw(page, context, ref.noteId);
      if (raw) {
        output.push(raw);
        succeeded++;
        if (succeeded % 10 === 0 || succeeded <= 5) {
          console.log(`[fetcher] ${succeeded} fetched (${processed} processed): ${raw.title.slice(0, 50)}`);
        }
      } else {
        errors.push({ noteId: ref.noteId, href: ref.href, stage: "fetcher", reason: "no_content" });
      }

      if (processed % 15 === 0) await page.waitForTimeout(1500);
    } catch (err) {
      const msg = (err as Error).message?.slice(0, 100) || "unknown";
      errors.push({
        noteId: ref.noteId,
        href: ref.href,
        stage: "fetcher",
        reason: msg.includes("Timeout") ? "timeout" : "error",
        message: msg,
      });
    }
  }

  console.log(`[fetcher] Done. ${succeeded} fetched, ${processed - succeeded} failed.`);
  output.done();
}

async function extractRaw(
  page: Page,
  context: BrowserContext,
  noteId: string,
): Promise<RawNote | null> {
  const title = await page
    .$eval("#detail-title, [class*='note-title'], .title", (el) => el.textContent?.trim() || "")
    .catch(() => "");

  const content = await page
    .$eval("#detail-desc, [class*='note-text'], [class*='desc']", (el) => el.textContent?.trim() || "")
    .catch(() => "");

  if (!title && !content) return null;

  let author = await page
    .$eval("[class*='username'], [class*='author'], [class*='nick']", (el) => el.textContent?.trim() || "")
    .catch(() => "");
  author = author.replace(/关注$/, "").replace(/Follow$/, "").trim();

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

  // Collect image URLs from page
  let imageUrls = await page
    .$$eval("img", (els) =>
      [...new Set(
        els
          .filter((el) => el.width > 100 && el.src.includes("rednotecdn") && !el.src.includes("avatar"))
          .map((el) => el.src),
      )],
    )
    .catch(() => [] as string[]);

  // Video thumbnail fallback
  if (imageUrls.length === 0) {
    const hasVideo = await page.$("video").catch(() => null);
    if (hasVideo) {
      try {
        const player = await page.$("[class*='player-container'], [class*='video-player']");
        if (player) {
          const screenshot = await player.screenshot({ type: "jpeg", quality: 80 });
          imageUrls = [`data:image/jpeg;base64,${screenshot.toString("base64")}`];
        }
      } catch {}
    }
  }

  // Download images as base64
  const imageBase64: string[] = [];
  for (const url of imageUrls.slice(0, 5)) {
    if (url.startsWith("data:")) {
      imageBase64.push(url);
      continue;
    }
    try {
      const resp = await context.request.get(url);
      if (resp.ok()) {
        const body = await resp.body();
        const ct = resp.headers()["content-type"] || "image/webp";
        imageBase64.push(`data:${ct};base64,${body.toString("base64")}`);
      }
    } catch {}
  }

  return {
    noteId,
    title,
    content,
    author: author || undefined,
    tags,
    location: location || undefined,
    publishedAt: publishedAt || undefined,
    imageBase64,
    sourceUrl: `xhsdiscover://item/${noteId}`,
  };
}
