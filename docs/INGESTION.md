# Curio Ingestion Guide

## Architecture

The ingestion pipeline scrapes saved posts from Xiaohongshu (rednote.com) and pushes them through the Curio API for embedding and storage.

```
Collector -> Fetcher -> Enricher -> Pusher
   |            |          |          |
   |            |          |          └── Batches notes to POST /api/sync/trigger
   |            |          └── Parallel GPT-4o vision (3 concurrent) for image descriptions
   |            └── Navigates to each note page, extracts DOM + downloads images
   └── Scrolls profile collect tab, outputs note IDs with xsec_tokens
```

### Pipeline stages

| Stage | File | Concurrency | What it does |
|-------|------|-------------|--------------|
| Collector | `src/ingestion/collector.ts` | 1 | Scrolls saved posts tab, collects note refs with xsec_tokens |
| Fetcher | `src/ingestion/fetcher.ts` | 1 (shared page) | Navigates to each note, extracts text/images, retries login walls 3x |
| Enricher | `src/ingestion/enricher.ts` | 3 parallel | Sends images to GPT-4o vision, appends descriptions to content |
| Pusher | `src/ingestion/pusher.ts` | 1 | Batches 5 notes per API call, checkpoints pushed IDs |
| Queue | `src/ingestion/queue.ts` | -- | Async iterable queue connecting stages |
| Pipeline | `src/ingestion/pipeline.ts` | -- | Orchestrator: collector runs first, then fetcher/enricher/pusher concurrently |

### Data flow

1. Collector outputs `NoteRef` (noteId + href with xsec_token)
2. Fetcher outputs `RawNote` (text + base64 images)
3. Enricher outputs `XhsNote` (text with vision descriptions, no images)
4. Pusher sends to API which embeds text and stores in PostgreSQL + pgvector

## CLI Commands

```bash
npm run ingest saved -- --user <xhs-user-id> --max 100   # Scrape saved posts
npm run ingest retry                                       # Retry failed notes
npm run ingest resume -- --user <xhs-user-id>             # Resume from checkpoint
npm run ingest status                                      # Show pipeline stats
```

## Prerequisites

### 1. Save browser cookies

The scraper needs XHS login cookies. Save them from a Chrome session:

```bash
# Start Chrome with debug port
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/chrome-debug-profile"

# Log into rednote.com in that Chrome

# Save cookies (from project root)
npx tsx src/scripts/save-cookies.ts

# Close debug Chrome -- no longer needed
```

This creates `xhs-session.json`. Cookies last 1-2 weeks before needing refresh.

### 2. Start the backend

```bash
npm run dev   # Starts Hono API on :3000
```

The API needs `DEV_AUTH_BYPASS=true` in `.env` for local ingestion (no Clerk token needed).

## Known Issues

### Anti-bot detection (安全限制)

XHS blocks automated access after ~100 requests in quick succession. When detected:
- The fetcher sees "安全限制" (security restriction) instead of note content
- The fetcher pauses 60s, retries, then pauses 120s if still blocked

**Mitigation**:
- The fetcher adds delays: 3s every 5 notes, 30s every 50 notes
- Run in smaller batches (--max 80) with manual pauses between runs
- The pusher checkpoint tracks what's already been pushed, so subsequent runs skip processed notes

**Current throttle limits** (observed):
- ~100 note page navigations before block triggers
- Block resets after ~5-10 minutes
- Login walls on ~15-25% of notes are per-note (deleted/restricted content), not anti-bot

### Login walls

Some notes show a login wall even with valid cookies. These are:
- Deleted posts
- Posts with content restrictions
- Video posts that require app-only access

The fetcher retries login walls 3 times with backoff (2s, 4s, 6s). Persistent failures are saved to `scrape-errors.json`.

### Cookie expiration

Cookies saved in `xhs-session.json` expire after 1-2 weeks. Symptoms:
- Collector finds 0 notes
- Popup/mask blocks the page

Fix: Re-run the save-cookies script with a fresh debug Chrome session.

## Files

```
src/ingestion/
  pipeline.ts       # Orchestrator
  collector.ts      # Stage 1: scroll + collect
  fetcher.ts        # Stage 2: navigate + extract
  enricher.ts       # Stage 3: parallel vision
  pusher.ts         # Stage 4: batch API push
  queue.ts          # Async queue with checkpoint
  types.ts          # NoteRef, RawNote, ScrapeError
  cli.ts            # CLI entry point
  processor.ts      # Text chunking + embedding (called by API)
  sync.ts           # DB write logic (called by API)

src/scripts/
  save-cookies.ts   # Save Chrome cookies to xhs-session.json
  seed.ts           # Seed DB with sample notes

Checkpoint files (gitignored):
  xhs-session.json          # Browser cookies
  scrape-errors.json        # Failed notes for retry
  checkpoint-pusher.json    # Pushed note IDs
  checkpoint-collector.json # Collector state
```

## Source URLs

Notes are stored with `xhsdiscover://item/{noteId}` as the source URL. This is a deep link that opens the note in the Xiaohongshu mobile app. It does not work on desktop browsers.

Web URLs (`rednote.com/explore/{noteId}`) require an `xsec_token` which expires. There is no known way to generate a valid xsec_token from just a note ID -- tokens can only be obtained from XHS API responses (search results, collect page, etc.).

## Future Improvements

- **Batch mode**: Run 80 notes at a time with 5-min cooldown between batches to avoid anti-bot
- **Use XHS feed API**: Call `/api/sns/web/v1/feed` directly instead of page navigation (faster, structured JSON, but requires signing algorithm -- see MediaCrawler's `sign_with_xhshow`)
- **Browser extension**: Capture saves in real-time from the XHS web app, no scraping needed
- **Multi-platform**: The pipeline architecture supports any platform -- add a new collector/fetcher pair
