import Markdown from "react-markdown";

interface Props {
  role: string;
  content: string;
}

function allowAllUrls(url: string) {
  return url;
}

export default function ChatMessage({ role, content }: Props) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-[var(--curio-red)] text-white rounded-br-md"
            : "bg-white border border-[var(--curio-border)] text-[var(--curio-text)] rounded-bl-md shadow-sm"
        }`}
      >
        {isUser ? (
          content
        ) : (
          <Markdown
            urlTransform={allowAllUrls}
            components={{
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 text-[var(--curio-red)] hover:opacity-70"
                >
                  {children}
                </a>
              ),
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
              li: ({ children }) => <li className="mb-1">{children}</li>,
              h3: ({ children }) => <h3 className="font-semibold mt-2 mb-1">{children}</h3>,
            }}
          >
            {content}
          </Markdown>
        )}
      </div>
    </div>
  );
}
