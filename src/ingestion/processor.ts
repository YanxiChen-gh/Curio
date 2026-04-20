import type { XhsNote } from "../types/xhs.js";
import { embedTexts } from "../lib/embeddings.js";

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 50;

export function composeDocument(note: XhsNote): string {
  const parts: string[] = [];
  if (note.title) parts.push(`标题: ${note.title}`);
  if (note.content) parts.push(note.content);
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
  const doc = composeDocument(note);
  const chunks = chunkText(doc);
  const embeddings = await embedTexts(chunks);
  return chunks.map((content, i) => ({
    content,
    embedding: embeddings[i],
  }));
}
