import type { Page } from "playwright";
import type { NoteRef } from "./types.js";
import { AsyncQueue } from "./queue.js";

export async function collect(
  page: Page,
  userId: string,
  maxNotes: number,
  output: AsyncQueue<NoteRef>,
) {
  // Navigate directly to the saved/collect tab URL
  console.log(`[collector] Opening saved posts page...`);
  await page.goto(`https://www.rednote.com/user/profile/${userId}?tab=fav&subTab=note`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForTimeout(3000);

  // Dismiss any popups
  for (let i = 0; i < 3; i++) {
    const hasPopup = await page.locator("i.reds-mask").isVisible({ timeout: 1000 }).catch(() => false);
    if (hasPopup) {
      console.log(`[collector] Dismissing popup...`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);
    } else {
      break;
    }
  }

  // Click the 收藏/Save tab if not already active
  const tabActive = await page.locator(".reds-tab-item.active", { hasText: /收藏|Save/ }).isVisible({ timeout: 1000 }).catch(() => false);
  if (!tabActive) {
    console.log(`[collector] Clicking saved/收藏 tab...`);
    await page.locator(".reds-tab-item", { hasText: /收藏|Save/ }).first().click({ force: true });
    await page.waitForTimeout(3000);
  }

  await page.waitForSelector(
    '.tab-content-item:nth-child(2) a[href*="xsec_token"]',
    { timeout: 10_000 },
  ).catch(() => {
    console.log("[collector] Warning: No saved note links found. Content may still be loading.");
  });
  await page.waitForTimeout(1000);

  const seen = new Set<string>();
  let staleRounds = 0;
  let lastCount = 0;

  while (seen.size < maxNotes && staleRounds < 5) {
    const found = await page.$$eval(
      '.tab-content-item:nth-child(2) a[href*="xsec_token"][href*="pc_collect"]',
      (els, uid) =>
        els
          .map((el) => {
            const href = el.getAttribute("href") || "";
            const match = href.match(new RegExp(`/user/profile/${uid}/([a-f0-9]{24})\\?`));
            if (!match) return null;
            return {
              id: match[1],
              href: href.startsWith("http") ? href : `https://www.rednote.com${href}`,
            };
          })
          .filter(Boolean) as Array<{ id: string; href: string }>,
      userId,
    );

    for (const f of found) {
      if (!seen.has(f.id) && seen.size < maxNotes) {
        seen.add(f.id);
        output.push({ noteId: f.id, href: f.href });
      }
    }

    if (seen.size === lastCount) {
      staleRounds++;
    } else {
      if (seen.size % 100 === 0 || seen.size <= 50) {
        console.log(`[collector] Found ${seen.size} saved notes...`);
      }
      staleRounds = 0;
      lastCount = seen.size;
    }

    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1500);
  }

  console.log(`[collector] Done. ${seen.size} note refs collected.`);
  output.done();
}
