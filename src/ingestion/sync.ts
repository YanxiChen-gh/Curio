import { db } from "../lib/db.js";
import { processNote } from "./processor.js";
import type { XhsNote } from "../types/xhs.js";

export async function ingestNotes(
  notes: XhsNote[],
  platform = "xiaohongshu",
  userId?: string,
): Promise<number> {
  let ingested = 0;

  for (const note of notes) {
    if (userId) {
      const exists = await db.note.findUnique({
        where: {
          userId_platform_externalId: { userId, platform, externalId: note.noteId },
        },
      });
      if (exists) continue;
    }

    const chunks = await processNote(note);

    await db.$transaction(async (tx) => {
      const dbNote = await tx.note.create({
        data: {
          externalId: note.noteId,
          platform,
          title: note.title,
          content: note.content,
          author: note.author,
          tags: note.tags,
          location: note.location,
          imageUrls: note.imageUrls,
          sourceUrl: note.sourceUrl,
          publishedAt: note.publishedAt,
          userId: userId!,
        },
      });

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const vectorStr = `[${chunk.embedding.join(",")}]`;
        const chunkId = crypto.randomUUID();
        await tx.$executeRawUnsafe(
          `INSERT INTO "Chunk" (id, content, embedding, "chunkIndex", "noteId")
           VALUES ($1, $2, $3::vector, $4, $5)`,
          chunkId,
          chunk.content,
          vectorStr,
          i,
          dbNote.id,
        );
      }
    });

    ingested++;
  }

  if (userId) {
    await db.syncState.upsert({
      where: { userId_platform: { userId, platform } },
      update: { lastSync: new Date() },
      create: { id: `${userId}-${platform}`, platform, userId, lastSync: new Date() },
    });
  }

  return ingested;
}
