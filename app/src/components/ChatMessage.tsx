import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";

interface Props {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export const ChatMessage = ({ role, content, timestamp }: Props) => {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} group ${
        isUser ? "animate-slide-in-right" : "animate-slide-in-left"
      }`}
    >
      <div
        className={`
          relative max-w-[85%] rounded-2xl px-5 py-4 text-sm break-words
          transition-all duration-300 ease-out
          ${
            isUser
              ? `
                bg-gradient-to-br from-[#3730a3] to-[var(--color-primary)]
                text-white
                shadow-[var(--shadow-md)]
                border border-[var(--color-primary)]/30
                hover:shadow-[var(--shadow-lg)]
                hover:scale-[1.01]
                hover:border-[var(--color-accent)]/40
                dark:from-[#4338ca] dark:to-[var(--color-primary)]
              `
              : `
                bg-gradient-to-br from-[var(--background-elevated)] via-[var(--background-secondary)] to-[var(--background-elevated)]
                text-[var(--foreground)]
                shadow-[var(--shadow-sm)]
                border border-[var(--border-color)]
                hover:shadow-[var(--shadow-md)]
                hover:-translate-y-1
                hover:border-[var(--color-primary)]/30
                dark:from-[var(--background-elevated)] dark:to-[var(--background-secondary)]
              `
          }
        `}
      >
        {/* Accent border on top for user messages */}
        {isUser && (
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        )}

        {/* Accent glow for assistant messages */}
        {!isUser && (
          <div className="absolute -inset-[1px] bg-gradient-to-r from-[var(--color-primary)]/0 via-[var(--color-primary)]/10 to-[var(--color-primary)]/0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-sm" />
        )}

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className={`
            absolute top-3 ${isUser ? "left-3" : "right-3"}
            p-1.5 rounded-lg
            opacity-0 group-hover:opacity-100
            transition-all duration-200
            ${
              isUser
                ? "bg-white/20 hover:bg-white/30 text-white"
                : "bg-[var(--background-secondary)] hover:bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--border-color)]"
            }
            active:scale-95
          `}
          aria-label="Copy message"
        >
          {copied ? (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          )}
        </button>

        {/* Message content */}
        <div className={`prose-chat ${isUser ? "prose-chat-user" : ""}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>

        {/* Timestamp (if provided) */}
        {timestamp && (
          <div
            className={`
              mt-2 pt-2 text-xs opacity-60 font-light
              ${isUser ? "text-white/80 border-t border-white/20" : "text-[var(--foreground-muted)] border-t border-[var(--border-color-light)]"}
            `}
          >
            {timestamp}
          </div>
        )}

        {/* Subtle noise texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl opacity-[0.02] mix-blend-overlay"
          style={{
            backgroundImage: "var(--noise-texture)",
          }}
        />
      </div>
    </div>
  );
};
