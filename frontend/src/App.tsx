import { useEffect, useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignIn,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";
import { MessageCircle, BookOpen, History } from "lucide-react";
import { setClerkGetToken } from "./lib/api";
import ChatView from "./components/ChatView";
import NotesList from "./components/NotesList";
import SessionList from "./components/SessionList";

const DEV_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === "true";

function ClerkTokenProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  useEffect(() => {
    setClerkGetToken(getToken);
  }, [getToken]);
  return <>{children}</>;
}

type Tab = "chat" | "notes" | "history";

function AppContent() {
  const [tab, setTab] = useState<Tab>("chat");
  const [sessionId, setSessionId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full">
      <header className="safe-top bg-white/80 backdrop-blur-md border-b border-[var(--curio-border)] px-4 pt-2 pb-2 flex-shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => { setSessionId(null); setTab("chat"); }}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--curio-red)] to-[var(--curio-red-light)] flex items-center justify-center text-white text-sm font-bold">
              拾
            </div>
            <h1 className="text-lg font-semibold text-[var(--curio-text)]">
              Curio
            </h1>
          </button>
          {DEV_BYPASS ? (
            <span className="text-xs text-[var(--curio-muted)]">Dev</span>
          ) : (
            <UserButton />
          )}
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

export default function App() {
  if (DEV_BYPASS) {
    return <AppContent />;
  }

  return (
    <>
      <SignedOut>
        <div className="flex flex-col items-center justify-center h-full px-6">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--curio-red)] to-[var(--curio-red-light)] flex items-center justify-center text-white text-3xl font-bold mb-6">
              拾
            </div>
            <h1 className="text-2xl font-semibold mb-1">Curio 拾趣</h1>
            <p className="text-sm text-[var(--curio-muted)] mb-6">
              Your personal knowledge assistant
            </p>
          </div>
          <SignIn routing="hash" />
        </div>
      </SignedOut>
      <SignedIn>
        <ClerkTokenProvider>
          <AppContent />
        </ClerkTokenProvider>
      </SignedIn>
    </>
  );
}
