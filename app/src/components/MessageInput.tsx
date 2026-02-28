"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export const MessageInput = ({ onSend, disabled }: Props) => {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const isComposingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
  };

  // textarea の高さを内容に応じて自動調整
  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return (
    <div
      className="flex w-full max-w-4xl gap-3 rounded-2xl border p-4 shadow-lg backdrop-blur-md transition-all duration-300"
      style={{
        background: 'var(--background-elevated-glass)',
        borderColor: 'var(--border-color)',
        boxShadow: isFocused
          ? '0 12px 32px rgba(13, 115, 119, 0.2), 0 4px 12px rgba(245, 158, 11, 0.15)'
          : 'var(--shadow-lg)',
      }}
    >
      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          rows={1}
          className="w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none transition-all duration-300 placeholder:transition-colors"
          style={{
            background: isFocused
              ? 'var(--input-focus-bg)'
              : 'var(--input-bg)',
            borderColor: isFocused ? 'var(--color-accent)' : 'var(--border-color)',
            color: 'var(--foreground)',
            boxShadow: isFocused
              ? '0 0 0 3px rgba(245, 158, 11, 0.15), 0 4px 12px rgba(13, 115, 119, 0.1)'
              : '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
          placeholder="メッセージを入力... (Ctrl+Enter / ⌘+Enter で送信)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !isComposingRef.current) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={disabled}
        />
      </div>
      <button
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label="メッセージを送信"
        className="group relative overflow-hidden rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition-all duration-300 disabled:cursor-not-allowed"
        style={{
          background: disabled || !value.trim()
            ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
            : 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)',
          transform: disabled || !value.trim() ? 'none' : undefined,
        }}
        onMouseEnter={(e) => {
          if (!disabled && value.trim()) {
            e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-primary) 100%)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(13, 115, 119, 0.3), 0 4px 12px rgba(245, 158, 11, 0.2)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && value.trim()) {
            e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(13, 115, 119, 0.2)';
          }
        }}
        onMouseDown={(e) => {
          if (!disabled && value.trim()) {
            e.currentTarget.style.transform = 'translateY(0) scale(0.96)';
          }
        }}
        onMouseUp={(e) => {
          if (!disabled && value.trim()) {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1)';
          }
        }}
      >
        <span className="relative z-10 flex items-center gap-2">
          送信
          <svg
            className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </span>
        {/* グロー効果 */}
        <div
          className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.2) 0%, transparent 70%)',
          }}
        />
      </button>

    </div>
  );
};
