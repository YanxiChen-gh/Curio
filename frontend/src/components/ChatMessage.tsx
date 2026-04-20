interface Props {
  role: string;
  content: string;
}

export default function ChatMessage({ role, content }: Props) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-[var(--curio-red)] text-white rounded-br-md"
            : "bg-white border border-[var(--curio-border)] text-[var(--curio-text)] rounded-bl-md shadow-sm"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
