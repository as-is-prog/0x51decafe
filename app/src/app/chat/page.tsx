"use client";

import useSWR from "swr";
import { useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChatMessage } from "@/components/ChatMessage";
import { MessageInput } from "@/components/MessageInput";
import { fetcher } from "@/lib/api";

interface Message {
  id: string;
  sender: "user" | "inhabitant";
  content: string;
  createdAt: number;
}

interface MessagesResponse {
  messages: Message[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export default function ChatPage() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, mutate } = useSWR<MessagesResponse>(
    "/api/chat/messages",
    fetcher,
    {
      refreshInterval: 3000, // 3秒ごとにポーリング
      revalidateOnFocus: true,
    }
  );

  const messages = data?.messages ?? [];

  // 新しいメッセージが来たら自動スクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = useCallback(
    async (content: string) => {
      // 楽観的更新
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        sender: "user",
        content,
        createdAt: Date.now(),
      };

      mutate(
        { messages: [...messages, optimisticMessage] },
        { revalidate: false }
      );

      try {
        await fetch(`${API_BASE}/api/chat/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sender: "user", content }),
        });
        // 送信成功後に再取得
        mutate();
      } catch (err) {
        console.error("Failed to send message:", err);
        // 失敗したら楽観的更新を取り消す
        mutate();
      }
    },
    [messages, mutate]
  );

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <main className="flex h-screen flex-col animate-fade-in">
      {/* Subtle background gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[var(--color-primary)] to-transparent" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full opacity-20 blur-3xl bg-gradient-to-tr from-[var(--color-accent)] to-transparent" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-10 border-b backdrop-blur-md" style={{
        borderColor: "var(--border-color)",
        background: "rgba(var(--background-rgb), 0.8)",
      }}>
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--color-primary)]"
              style={{ color: "var(--foreground-secondary)" }}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              戻る
            </Link>
            <h1
              className="text-xl font-bold"
              style={{
                background: "var(--gradient-primary)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {process.env.NEXT_PUBLIC_INHABITANT_NAME || "Chat"}
            </h1>
            <div className="w-16" /> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        <div className="mx-auto max-w-4xl space-y-4">
          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
            </div>
          )}

          {!isLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div
                className="rounded-full p-6 mb-6"
                style={{
                  background: "var(--gradient-subtle)",
                  border: "2px solid var(--border-color)",
                }}
              >
                <svg
                  className="h-12 w-12"
                  style={{ color: "var(--color-primary)" }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h3
                className="text-xl font-semibold mb-2"
                style={{ color: "var(--foreground)" }}
              >
                メッセージがありません
              </h3>
              <p style={{ color: "var(--foreground-secondary)" }}>
                メッセージを送って会話を始めましょう
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.sender === "user" ? "user" : "assistant"}
              content={msg.content}
              timestamp={formatTime(msg.createdAt)}
            />
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 pb-4 pt-2" style={{ background: "var(--background)" }}>
        <div className="mx-auto max-w-4xl">
          <MessageInput onSend={handleSend} />
        </div>
      </div>
    </main>
  );
}
