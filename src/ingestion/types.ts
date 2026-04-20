export interface NoteRef {
  noteId: string;
  href: string;
}

export interface RawNote {
  noteId: string;
  title: string;
  content: string;
  author?: string;
  tags: string[];
  location?: string;
  publishedAt?: string;
  imageBase64: string[];
  sourceUrl: string;
}

export interface ScrapeError {
  noteId: string;
  href: string;
  stage: "collector" | "fetcher" | "enricher" | "pusher";
  reason: "login_wall" | "timeout" | "no_content" | "vision_fail" | "api_error" | "error";
  message?: string;
}
