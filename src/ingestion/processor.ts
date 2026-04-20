import type { XhsNote } from "../types/xhs.js";
import { embedTexts } from "../lib/embeddings.js";
import { describeImages } from "../lib/vision.js";

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 50;

export async function composeDocument(note: XhsNote): Promise<string> {
  const parts: string[] = [];
  if (note.title) parts.push(`标题: ${note.title}`);
  if (note.content) parts.push(note.content);

  if (note.imageUrls.length > 0) {
    const descriptions = await describeImages(note.imageUrls, note.title);
    if (descriptions.length === note.imageUrls.length) {
      for (let i = 0; i < descriptions.length; i++) {
        parts.push(`[图片${i + 1}]: ${descriptions[i]}`);
      }
    } else if (descriptions.length === 1) {
      parts.push(`[图片描述]: ${descriptions[0]}`);
    }
  }

  if (note.tags.length > 0) parts.push(`标签: ${note.tags.join(", ")}`);
  if (note.location) parts.push(`位置: ${note.location}`);
  if (note.author) parts.push(`作者: ${note.author}`);
  return parts.join("\n\n");
}

export function chunkText(text: string): string[] {
  const words = text.split("");
  if (words.length <= CHUNK_SIZE) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + CHUNK_SIZE, words.length);
    chunks.push(words.slice(start, end).join(""));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

export async function processNote(
  note: XhsNote,
): Promise<Array<{ content: string; embedding: number[] }>> {
  const doc = await composeDocument(note);
  const chunks = chunkText(doc);
  const embeddings = await embedTexts(chunks);
  return chunks.map((content, i) => ({
    content,
    embedding: embeddings[i],
  }));
}
