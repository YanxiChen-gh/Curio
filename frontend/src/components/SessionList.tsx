import { useEffect, useState } from "react";
import { Plus, Trash2, MessageCircle } from "lucide-react";
import { api, authHeaders } from "../lib/api";

interface Session {
  id: string;
  title: string;
  updatedAt: string;
  _count: { messages: number };
}

interface Props {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export default function SessionList({ activeId, onSelect, onNew }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);

  const load = () => {
    api<{ sessions: Session[] }>("/api/sessions").then((d) =>
      setSessions(d.sessions),
    );
  };

  useEffect(load, [activeId]);

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/sessions/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    load();
    if (activeId === id) onNew();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-[var(--curio-border)]">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-[var(--curio-border)] text-sm text-[var(--curio-muted)] hover:border-[var(--curio-red)] hover:text-[var(--curio-red)] transition-colors"
        >
          <Plus size={16} /> New Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left px-4 py-3 border-b border-[var(--curio-border)] flex items-center gap-3 transition-colors ${
              activeId === s.id
                ? "bg-red-50 text-[var(--curio-red)]"
                : "hover:bg-gray-50"
            }`}
          >
            <MessageCircle size={16} className="flex-shrink-0 opacity-50" />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{s.title}</p>
              <p className="text-[10px] text-[var(--curio-muted)]">
                {s._count.messages} messages
              </p>
            </div>
            <button
              onClick={(e) => deleteSession(s.id, e)}
              className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-1"
            >
              <Trash2 size={14} />
            </button>
          </button>
        ))}
      </div>
    </div>
  );
}
