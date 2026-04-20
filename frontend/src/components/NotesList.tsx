import { useEffect, useState } from "react";
import { MapPin, Tag } from "lucide-react";
import { api } from "../lib/api";

interface Note {
  id: string;
  externalId: string;
  platform: string;
  title: string;
  content: string;
  author?: string;
  tags: string[];
  location?: string;
  sourceUrl: string;
  syncedAt: string;
}

export default function NotesList() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ notes: Note[] }>("/api/notes")
      .then((data) => {
        setNotes(data.notes || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--curio-muted)]">
        Loading...
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <p className="text-[var(--curio-muted)] text-sm">
          No notes yet. Run the ingestion to import your saved posts.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full px-4 py-4">
      <div className="max-w-2xl mx-auto space-y-3">
        <p className="text-xs text-[var(--curio-muted)] px-1">
          {notes.length} notes ingested
        </p>
        {notes.map((note) => (
          <div
            key={note.id}
            className="bg-white rounded-2xl border border-[var(--curio-border)] p-4 shadow-sm"
          >
            <div className="mb-2">
              <a
                href={note.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-sm leading-snug hover:text-[var(--curio-red)] transition-colors"
              >
                {note.title}
              </a>
            </div>

            <p className="text-xs text-[var(--curio-muted)] line-clamp-3 mb-3">
              {note.content}
            </p>

            <div className="flex flex-wrap gap-2 items-center">
              {note.platform && (
                <span className="text-[10px] text-white bg-[var(--curio-red)] rounded-full px-2 py-0.5">
                  {note.platform}
                </span>
              )}
              {note.location && (
                <span className="inline-flex items-center gap-1 text-[10px] text-[var(--curio-muted)] bg-[var(--curio-bg)] rounded-full px-2 py-0.5">
                  <MapPin size={10} />
                  {note.location}
                </span>
              )}
              {note.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-[10px] text-[var(--curio-red)] bg-red-50 rounded-full px-2 py-0.5"
                >
                  <Tag size={10} />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
