import type { XhsNote } from "../types/xhs.js";
import type { RawNote, ScrapeError } from "./types.js";
import { describeImages } from "../lib/vision.js";
import { AsyncQueue } from "./queue.js";

const CONCURRENCY = 3;

async function enrichOne(raw: RawNote): Promise<XhsNote> {
  let enrichedContent = raw.content;

  if (raw.imageBase64.length > 0) {
    try {
      const descriptions = await describeImages(raw.imageBase64, raw.title);
      if (descriptions.length === raw.imageBase64.length) {
        const descText = descriptions.map((d, i) => `[图片${i + 1}]: ${d}`).join("\n\n");
        enrichedContent = raw.content + "\n\n" + descText;
      } else if (descriptions.length === 1) {
        enrichedContent = raw.content + "\n\n[图片描述]: " + descriptions[0];
      }
    } catch {}
  }

  return {
    noteId: raw.noteId,
    title: raw.title,
    content: enrichedContent,
    author: raw.author,
    tags: raw.tags,
    location: raw.location,
    imageUrls: [],
    sourceUrl: raw.sourceUrl,
    publishedAt: raw.publishedAt,
  };
}

export async function enrich(
  input: AsyncQueue<RawNote>,
  output: AsyncQueue<XhsNote>,
  errors: ScrapeError[],
) {
  let processed = 0;
  let withImages = 0;
  const inflight: Promise<void>[] = [];

  for await (const raw of input) {
    const task = (async () => {
      try {
        const note = await enrichOne(raw);
        output.push(note);
        processed++;
        if (raw.imageBase64.length > 0) withImages++;
        if (processed % 10 === 0 || processed <= 3) {
          console.log(`[enricher] ${processed} enriched (${withImages} with vision): ${raw.title.slice(0, 50)}`);
        }
      } catch (err) {
        errors.push({
          noteId: raw.noteId,
          href: raw.sourceUrl,
          stage: "enricher",
          reason: "vision_fail",
          message: (err as Error).message?.slice(0, 100),
        });
        // Still push the note without vision enrichment
        output.push({
          noteId: raw.noteId,
          title: raw.title,
          content: raw.content,
          author: raw.author,
          tags: raw.tags,
          location: raw.location,
          imageUrls: [],
          sourceUrl: raw.sourceUrl,
          publishedAt: raw.publishedAt,
        });
        processed++;
      }
    })();

    inflight.push(task);

    if (inflight.length >= CONCURRENCY) {
      await Promise.race(inflight);
      // Remove settled promises
      for (let i = inflight.length - 1; i >= 0; i--) {
        const settled = await Promise.race([
          inflight[i].then(() => true),
          Promise.resolve(false),
        ]);
        if (settled) inflight.splice(i, 1);
      }
    }
  }

  // Wait for all remaining
  await Promise.all(inflight);

  console.log(`[enricher] Done. ${processed} enriched, ${withImages} with vision.`);
  output.done();
}
