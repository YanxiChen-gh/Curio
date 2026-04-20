import { chromium, type BrowserContext, type Page } from "playwright";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { resolve } from "path";
import type { NoteRef, RawNote, ScrapeError } from "./types.js";
import type { XhsNote } from "../types/xhs.js";
import { AsyncQueue } from "./queue.js";
import { collect } from "./collector.js";
import { fetch as fetchNotes } from "./fetcher.js";
import { enrich } from "./enricher.js";
import { push } from "./pusher.js";

const CDP_URL = process.env.CHROME_CDP_URL;
const SESSION_FILE = process.env.XHS_SESSION_FILE || resolve(process.cwd(), "xhs-session.json");
const COLLECTOR_CHECKPOINT = "checkpoint-collector.json";
const ERROR_FILE = "scrape-errors.json";

interface PipelineOptions {
  userId: string;
  maxNotes: number;
  apiUrl: string;
  token?: string;
  resume?: boolean;
}

export async function runPipeline(opts: PipelineOptions) {
  const { userId, maxNotes, apiUrl, token, resume } = opts;
  const errors: ScrapeError[] = [];

  // Set up browser
  let browser;
  let context: BrowserContext;
  let page: Page;
  let shouldClose = false;

  if (CDP_URL) {
    console.log(`[pipeline] Connecting to Chrome via CDP: ${CDP_URL}`);
    browser = await chromium.connectOverCDP(CDP_URL);
    context = browser.contexts()[0];
    page = await context.newPage();
  } else {
    console.log(`[pipeline] Launching headless Chromium`);
    if (!existsSync(SESSION_FILE)) {
      throw new Error(`Session file not found: ${SESSION_FILE}`);
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
    // Create queues
    const noteRefQueue = new AsyncQueue<NoteRef>();
    const rawNoteQueue = new AsyncQueue<RawNote>();
    const enrichedQueue = new AsyncQueue<XhsNote>();

    // Resume: reload collector checkpoint
    if (resume) {
      const savedRefs = AsyncQueue.resume<NoteRef>(COLLECTOR_CHECKPOINT);
      if (savedRefs.length > 0) {
        console.log(`[pipeline] Resuming with ${savedRefs.length} collected refs from checkpoint`);
        noteRefQueue.pushMany(savedRefs);
        noteRefQueue.done();
      }
    }

    // Stage 1: Collector runs first (uses the same page as fetcher, can't overlap)
    if (!resume || noteRefQueue.size === 0) {
      await collect(page, userId, maxNotes, noteRefQueue);
    }

    // Stage 2-4: Fetcher, Enricher, Pusher run concurrently
    // (fetcher uses the page sequentially, enricher + pusher overlap with it)
    await Promise.all([
      fetchNotes(page, context, noteRefQueue, rawNoteQueue, errors),
      enrich(rawNoteQueue, enrichedQueue, errors),
      push(enrichedQueue, errors, apiUrl, token),
    ]);

    // Save errors
    writeFileSync(ERROR_FILE, JSON.stringify(errors, null, 2));
    const loginWalls = errors.filter((e) => e.reason === "login_wall").length;
    const otherErrors = errors.length - loginWalls;
    console.log(`\n[pipeline] Complete. ${loginWalls} login walls, ${otherErrors} other errors.`);
    if (errors.length > 0) {
      console.log(`[pipeline] Errors saved to ${ERROR_FILE}`);
    }
  } finally {
    await page.close();
    if (shouldClose) await context.close();
  }
}

export async function retryErrors(apiUrl: string, token?: string) {
  if (!existsSync(ERROR_FILE)) {
    console.log("[retry] No error file found.");
    return;
  }

  const prevErrors: ScrapeError[] = JSON.parse(readFileSync(ERROR_FILE, "utf-8"));
  const retryable = prevErrors.filter((e) => e.reason === "login_wall" || e.reason === "timeout");
  const nonRetryable = prevErrors.filter((e) => e.reason !== "login_wall" && e.reason !== "timeout");
  console.log(`[retry] ${retryable.length} retryable, ${nonRetryable.length} non-retryable (kept)`);

  if (retryable.length === 0) return;

  let browser;
  let context: BrowserContext;
  let page: Page;
  let shouldClose = false;

  if (CDP_URL) {
    browser = await chromium.connectOverCDP(CDP_URL);
    context = browser.contexts()[0];
    page = await context.newPage();
  } else {
    console.log(`[retry] Launching headless Chromium`);
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
    const noteRefQueue = new AsyncQueue<NoteRef>();
    const rawNoteQueue = new AsyncQueue<RawNote>();
    const enrichedQueue = new AsyncQueue<XhsNote>();
    const newErrors: ScrapeError[] = [...nonRetryable];

    // Push retryable errors as note refs
    for (const e of retryable) {
      noteRefQueue.push({ noteId: e.noteId, href: e.href });
    }
    noteRefQueue.done();

    await Promise.all([
      fetchNotes(page, context, noteRefQueue, rawNoteQueue, newErrors),
      enrich(rawNoteQueue, enrichedQueue, newErrors),
      push(enrichedQueue, newErrors, apiUrl, token),
    ]);

    writeFileSync(ERROR_FILE, JSON.stringify(newErrors, null, 2));
    const recovered = retryable.length - newErrors.filter((e) => retryable.some((r) => r.noteId === e.noteId)).length;
    console.log(`\n[retry] Recovered ${recovered} notes. ${newErrors.length} errors remain.`);
  } finally {
    await page.close();
    if (shouldClose) await context.close();
  }
}

export function showStatus() {
  console.log("=== Curio Ingestion Status ===\n");

  if (existsSync(ERROR_FILE)) {
    const errors: ScrapeError[] = JSON.parse(readFileSync(ERROR_FILE, "utf-8"));
    const byStage: Record<string, number> = {};
    const byReason: Record<string, number> = {};
    for (const e of errors) {
      byStage[e.stage] = (byStage[e.stage] || 0) + 1;
      byReason[e.reason] = (byReason[e.reason] || 0) + 1;
    }
    console.log(`Errors: ${errors.length}`);
    console.log("  By stage:", byStage);
    console.log("  By reason:", byReason);
  } else {
    console.log("No error file found.");
  }

  if (existsSync("checkpoint-pusher.json")) {
    const pushed = JSON.parse(readFileSync("checkpoint-pusher.json", "utf-8"));
    console.log(`\nPushed: ${pushed.length} notes`);
  }

  if (existsSync(COLLECTOR_CHECKPOINT)) {
    const refs = JSON.parse(readFileSync(COLLECTOR_CHECKPOINT, "utf-8"));
    console.log(`Collector checkpoint: ${refs.length} refs`);
  }
}
