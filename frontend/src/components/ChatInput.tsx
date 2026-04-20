import { Send } from "lucide-react";
import type { FormEvent } from "react";

interface Props {
  input: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  isLoading: boolean;
}

export default function ChatInput({
  input,
  onChange,
  onSubmit,
  isLoading,
}: Props) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as FormEvent);
    }
  };

  return (
    <div className="safe-bottom border-t border-[var(--curio-border)] bg-white/80 backdrop-blur-md px-4 pt-3 pb-3 flex-shrink-0">
      <form
        onSubmit={onSubmit}
        className="max-w-2xl mx-auto flex items-center gap-2"
      >
        <textarea
          rows={1}
          value={input}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="问问你收藏的笔记..."
          className="flex-1 resize-none rounded-2xl border border-[var(--curio-border)] bg-[var(--curio-bg)] px-4 text-[16px] leading-snug focus:outline-none focus:border-[var(--curio-red)] focus:ring-1 focus:ring-[var(--curio-red-light)] transition-colors placeholder:text-[var(--curio-muted)]"
          style={{ maxHeight: "120px", height: "44px", paddingTop: "10px", paddingBottom: "10px" }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "44px";
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="flex-shrink-0 w-[44px] h-[44px] rounded-full bg-[var(--curio-red)] text-white flex items-center justify-center disabled:opacity-40 transition-opacity active:scale-95"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
