import { useEffect, useState } from "react";
import { MessageCircle, BookOpen, History, LogOut } from "lucide-react";
import { isLoggedIn, getMe, clearToken } from "./lib/api";
import AuthScreen from "./components/AuthScreen";
import AuthCallback from "./components/AuthCallback";
import ChatView from "./components/ChatView";
import NotesList from "./components/NotesList";
import SessionList from "./components/SessionList";

type Tab = "chat" | "notes" | "history";

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("chat");
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoggedIn()) {
      getMe()
        .then(setUser)
        .catch(() => clearToken())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--curio-muted)]">
        Loading...
      </div>
    );
  }

  if (window.location.pathname === "/auth/callback") {
    return <AuthCallback onAuth={setUser} />;
  }

  if (!user) {
    return <AuthScreen onAuth={setUser} />;
  }

  return (
    <div className="flex flex-col h-full">
      <header className="safe-top bg-white/80 backdrop-blur-md border-b border-[var(--curio-border)] px-4 pt-2 pb-2 flex-shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--curio-red)] to-[var(--curio-red-light)] flex items-center justify-center text-white text-sm font-bold">
              拾
            </div>
            <h1 className="text-lg font-semibold text-[var(--curio-text)]">
              Curio
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="w-7 h-7 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-xs text-[var(--curio-muted)]">
                {user.name}
              </span>
            )}
            <button
              onClick={() => {
                clearToken();
                setUser(null);
              }}
              className="text-[var(--curio-muted)] hover:text-[var(--curio-red)]"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden">
        {tab === "chat" && (
          <ChatView
            sessionId={sessionId}
            onSessionCreated={setSessionId}
          />
        )}
        {tab === "notes" && <NotesList />}
        {tab === "history" && (
          <SessionList
            activeId={sessionId}
            onSelect={(id) => {
              setSessionId(id);
              setTab("chat");
            }}
            onNew={() => {
              setSessionId(null);
              setTab("chat");
            }}
          />
        )}
      </main>

      <nav className="safe-bottom bg-white/80 backdrop-blur-md border-t border-[var(--curio-border)] flex-shrink-0">
        <div className="max-w-2xl mx-auto flex">
          {[
            { key: "chat" as Tab, icon: MessageCircle, label: "Chat" },
            { key: "history" as Tab, icon: History, label: "History" },
            { key: "notes" as Tab, icon: BookOpen, label: "Notes" },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${
                tab === key
                  ? "text-[var(--curio-red)]"
                  : "text-[var(--curio-muted)]"
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px]">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
