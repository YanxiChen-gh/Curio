import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { XhsNote, XhsOpenCliNote } from "../types/xhs.js";

const exec = promisify(execFile);

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const opencliPath = resolve(projectRoot, "node_modules/.bin/opencli");

async function runOpenCli(args: string[]): Promise<string> {
  const { stdout } = await exec(opencliPath, args, {
    timeout: 60_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

function normalizeNote(raw: XhsOpenCliNote): XhsNote {
  const noteId = raw.note_id || raw.id || "";
  return {
    noteId,
    title: raw.title || "",
    content: raw.desc || raw.content || "",
    author: raw.user?.nickname,
    tags: raw.tag_list?.map((t) => t.name).filter(Boolean) as string[] || [],
    location: raw.ip_location,
    imageUrls:
      raw.image_list?.map((i) => i.url || i.url_default).filter(Boolean) as string[] || [],
    sourceUrl:
      raw.share_info?.link || `https://www.xiaohongshu.com/explore/${noteId}`,
  };
}

export async function fetchNoteDetail(noteId: string): Promise<XhsNote> {
  const stdout = await runOpenCli([
    "xiaohongshu",
    "note",
    noteId,
    "-f",
    "json",
  ]);
  const raw = JSON.parse(stdout) as XhsOpenCliNote;
  return normalizeNote(raw);
}

export async function fetchUserFeed(limit = 20): Promise<XhsNote[]> {
  const stdout = await runOpenCli([
    "xiaohongshu",
    "feed",
    "--limit",
    String(limit),
    "-f",
    "json",
  ]);
  const items = JSON.parse(stdout);
  const notes = Array.isArray(items) ? items : [items];
  return notes.map(normalizeNote);
}

export async function searchNotes(
  query: string,
  limit = 20,
): Promise<XhsNote[]> {
  const stdout = await runOpenCli([
    "xiaohongshu",
    "search",
    query,
    "--limit",
    String(limit),
    "-f",
    "json",
  ]);
  const items = JSON.parse(stdout);
  const notes = Array.isArray(items) ? items : [items];
  return notes.map(normalizeNote);
}
