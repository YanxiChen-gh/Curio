import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, Tag } from "lucide-react";
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

const PAGE_SIZE = 20;

export default function NotesList() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadNotes = useCallback(async (offset: number) => {
    const data = await api<{ notes: Note[]; total: number }>(
      `/api/notes?limit=${PAGE_SIZE}&offset=${offset}`,
    );
    return data;
  }, []);

  useEffect(() => {
    loadNotes(0)
      .then((data) => {
        setNotes(data.notes || []);
        setTotal(data.total);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [loadNotes]);

  const loadMore = useCallback(async () => {
    if (loadingMore || notes.length >= total) return;
    setLoadingMore(true);
    const data = await loadNotes(notes.length);
    setNotes((prev) => [...prev, ...(data.notes || [])]);
    setLoadingMore(false);
  }, [loadNotes, loadingMore, notes.length, total]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
        loadMore();
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [loadMore]);

  const filtered = useMemo(() => {
    if (!query.trim()) return notes;
    const q = query.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)) ||
        (n.location && n.location.toLowerCase().includes(q)) ||
        (n.author && n.author.toLowerCase().includes(q)),
    );
  }, [notes, query]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--curio-muted)]">
        Loading...
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <p className="text-[var(--curio-muted)] text-sm">
          No notes yet. Run the ingestion to import your saved posts.
        </p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="overflow-y-auto h-full px-4 py-4">
      <div className="max-w-2xl mx-auto space-y-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--curio-muted)]"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--curio-border)] bg-white text-sm focus:outline-none focus:border-[var(--curio-red)] transition-colors placeholder:text-[var(--curio-muted)]"
          />
        </div>

        <p className="text-xs text-[var(--curio-muted)] px-1">
          {query ? `${filtered.length} of ${total}` : `${notes.length} of ${total}`} notes
        </p>

        {filtered.map((note) => (
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

        {loadingMore && (
          <p className="text-center text-xs text-[var(--curio-muted)] py-4">
            Loading more...
          </p>
        )}

        {query && filtered.length === 0 && (
          <p className="text-center text-sm text-[var(--curio-muted)] py-8">
            No notes matching "{query}"
          </p>
        )}

        {!query && notes.length >= total && notes.length > 0 && (
          <p className="text-center text-xs text-[var(--curio-muted)] py-4">
            All {total} notes loaded
          </p>
        )}
      </div>
    </div>
  );
}
