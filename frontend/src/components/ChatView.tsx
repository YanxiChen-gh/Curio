import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { api } from "../lib/api";

interface Props {
  sessionId: string | null;
  onSessionCreated: (id: string) => void;
}

interface StoredMessage {
  id: string;
  role: string;
  content: string;
}

export default function ChatView({ sessionId, onSessionCreated: _onSessionCreated }: Props) {
  const { getToken } = useAuth();
  const [history, setHistory] = useState<StoredMessage[]>([]);
  const chatKey = sessionId || "new";

  useEffect(() => {
    if (sessionId) {
      api<{ messages: StoredMessage[] }>(
        `/api/sessions/${sessionId}/messages`,
      ).then((d) => setHistory(d.messages));
    } else {
      setHistory([]);
    }
  }, [sessionId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async () => {
          const token = await getToken();
          return token
            ? ({ Authorization: `Bearer ${token}` } as Record<string, string>)
            : ({} as Record<string, string>);
        },
        body: { sessionId },
        credentials: "include",
      }),
    [sessionId, getToken],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: chatKey,
    transport,
  });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, history]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input.trim() });
    setInput("");
  };

  const allMessages = [
    ...history.map((m) => ({ id: m.id, role: m.role, text: m.content })),
    ...messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      text:
        msg.parts
          ?.filter(
            (p): p is { type: "text"; text: string } => p.type === "text",
          )
          .map((p) => p.text)
          .join("") || "",
    })),
  ];

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {allMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--curio-red)] to-[var(--curio-red-light)] flex items-center justify-center text-white text-2xl font-bold mb-4">
                拾
              </div>
              <h2 className="text-xl font-semibold mb-2">Curio 拾趣</h2>
              <p className="text-[var(--curio-muted)] text-sm max-w-xs">
                Ask me anything about your saved posts. Try
                "涩谷附近有什么好吃的？" or "recommend a coffee shop in Shanghai"
              </p>
            </div>
          )}

          {allMessages.map((msg) => (
            <ChatMessage key={msg.id} role={msg.role} content={msg.text} />
          ))}

          {isLoading &&
            (allMessages.length === 0 ||
              allMessages[allMessages.length - 1]?.role !== "assistant") && (
              <div className="flex gap-1 items-center text-[var(--curio-muted)] text-sm pl-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--curio-red)] animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--curio-red)] animate-pulse [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--curio-red)] animate-pulse [animation-delay:0.4s]" />
              </div>
            )}

          {error && (
            <div className="rounded-xl bg-red-50 text-red-600 text-sm px-4 py-3">
              Error: {error.message}
            </div>
          )}
        </div>
      </div>

      <ChatInput
        input={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
