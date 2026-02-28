"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { io, type Socket } from "socket.io-client";
import { socketUrl } from "@/lib/api";
import { ChatMessage } from "@/components/ChatMessage";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { MessageInput } from "@/components/MessageInput";

// ----------------------------------------------------------------
// 型定義
// ----------------------------------------------------------------

interface TalkMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  choices?: string[];
  questionId?: string;
  selectedChoice?: string;
}

interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  numTurns: number;
  totalCostUsd: number;
}

const CONTEXT_WINDOW = 200_000; // Claude のコンテキストウィンドウ
const AUTO_COMPACT_THRESHOLD = 0.80; // 80% で自動 compact が走る

// ----------------------------------------------------------------
// Talk ページ
// ----------------------------------------------------------------

export default function TalkPage() {
  const [messages, setMessages] = useState<TalkMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自動スクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isStreaming]);

  // Socket.io 接続
  useEffect(() => {
    const sock = io(socketUrl, {
      autoConnect: true,
      transports: ["websocket"],
      query: { page: "talk" },
    });
    socketRef.current = sock;

    sock.on("connect", () => {
      console.log("[talk] connected", sock.id);
      setConnected(true);
      // パーミッション状態を取得
      sock.emit("permission:get");
    });

    // パーミッション状態変更通知
    sock.on("permission:changed", (payload: { skipPermissions: boolean }) => {
      setSkipPermissions(payload.skipPermissions);
    });

    sock.on("disconnect", () => {
      console.log("[talk] disconnected");
      setConnected(false);
    });

    // ストリーミングチャンク（内心 — 表示しない、思考中の信号としてのみ使う）
    sock.on("talk:chunk", (_payload: { text: string }) => {
      // 内心は蓄積しない。isStreaming が true なので ThinkingIndicator が表示される
    });

    // ストリーミング完了（内心の終了 — 思考中インジケーターを消す）
    sock.on("talk:done", (payload: { sessionId: string | null; usage?: UsageInfo }) => {
      if (payload.usage) {
        setUsage(payload.usage);
      }
      setIsStreaming(false);
    });

    // エラー
    sock.on("talk:error", (payload: { error: string }) => {
      console.error("[talk] error:", payload.error);
      setIsStreaming(false);
      const errorMsg: TalkMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `*接続エラー: ${payload.error}*`,
      };
      setMessages((msgs) => [...msgs, errorMsg]);
    });

    // speak:message — リアルタイム発話（これだけがユーザーに見える）
    sock.on("speak:message", (payload: { content: string; surface?: number; timestamp: number }) => {
      const speakMsg: TalkMessage = {
        id: `speak-${payload.timestamp}`,
        role: "assistant",
        content: payload.content,
      };
      setMessages((msgs) => [...msgs, speakMsg]);
    });

    // ask:question — 選択肢付きの質問
    sock.on("ask:question", (payload: { id: string; content: string; choices: string[]; timestamp: number }) => {
      const askMsg: TalkMessage = {
        id: `ask-${payload.timestamp}`,
        role: "assistant",
        content: payload.content,
        choices: payload.choices,
        questionId: payload.id,
      };
      setMessages((msgs) => [...msgs, askMsg]);
    });

    return () => {
      sock.disconnect();
      socketRef.current = null;
    };
  }, []);

  // パーミッション切り替え
  const togglePermission = useCallback(() => {
    if (!socketRef.current || !connected) return;
    socketRef.current.emit("permission:set", { skipPermissions: !skipPermissions });
  }, [connected, skipPermissions]);

  // 選択肢の回答
  const handleChoice = useCallback(
    (questionId: string, choice: string) => {
      if (!socketRef.current || !connected) return;
      socketRef.current.emit("ask:answer", { id: questionId, choice });

      // 質問メッセージのボタンを消して選択済み表示に
      setMessages((msgs) =>
        msgs.map((msg) =>
          msg.questionId === questionId
            ? { ...msg, selectedChoice: choice, choices: undefined }
            : msg
        )
      );

      // ユーザーの選択をメッセージとして表示
      const userMsg: TalkMessage = {
        id: `choice-${Date.now()}`,
        role: "user",
        content: choice,
      };
      setMessages((msgs) => [...msgs, userMsg]);
    },
    [connected]
  );

  // メッセージ送信
  const handleSend = useCallback(
    (text: string) => {
      if (!socketRef.current || !connected || isStreaming) return;

      // ユーザーメッセージを追加
      const userMsg: TalkMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);

      // ストリーミング開始
      setIsStreaming(true);
      socketRef.current.emit("talk:send", { text });
    },
    [connected, isStreaming]
  );

  return (
    <main className="flex h-screen flex-col animate-fade-in">
      {/* Background gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[var(--color-primary)] to-transparent" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full opacity-20 blur-3xl bg-gradient-to-tr from-[var(--color-accent)] to-transparent" />
      </div>

      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--border-color)",
          background: "rgba(var(--background-rgb), 0.8)",
        }}
      >
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
            <div className="flex items-center gap-3">
              <h1
                className="text-xl font-bold"
                style={{
                  background: "var(--gradient-primary)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Talk
              </h1>
              {/* 接続状態インジケータ */}
              <span
                className="inline-block h-2.5 w-2.5 rounded-full transition-colors"
                style={{
                  backgroundColor: connected
                    ? "var(--color-success)"
                    : "var(--color-error)",
                }}
                title={connected ? "接続中" : "未接続"}
              />
            </div>
            {/* パーミッショントグル */}
            <button
              type="button"
              onClick={togglePermission}
              onTouchEnd={(e) => {
                e.preventDefault();
                togglePermission();
              }}
              disabled={!connected}
              aria-label={skipPermissions ? "権限チェック: OFF (自動許可)" : "権限チェック: ON (要承認)"}
              className="relative z-20 flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-all duration-200 disabled:opacity-40"
              style={{
                background: skipPermissions
                  ? "rgba(239, 68, 68, 0.12)"
                  : "rgba(34, 197, 94, 0.12)",
                color: skipPermissions
                  ? "var(--color-error, #ef4444)"
                  : "var(--color-success, #22c55e)",
                border: `1px solid ${skipPermissions ? "rgba(239, 68, 68, 0.25)" : "rgba(34, 197, 94, 0.25)"}`,
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <svg className="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {skipPermissions ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                )}
              </svg>
              <span className="pointer-events-none">{skipPermissions ? "自動" : "承認"}</span>
            </button>
          </div>
          {/* コンテキスト占有率バー */}
          {usage && (() => {
            const contextTokens = usage.inputTokens; // daemon が直近 assistant usage から算出済み
            const percent = Math.min((contextTokens / CONTEXT_WINDOW) * 100, 100);
            const compactPercent = AUTO_COMPACT_THRESHOLD * 100;
            const isHigh = percent > 70;
            const isCritical = percent > compactPercent;
            return (
              <div className="mt-3 flex items-center gap-3">
                <div
                  className="relative flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{ background: "var(--border-color)" }}
                >
                  {/* 使用量バー */}
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${percent}%`,
                      background: isCritical
                        ? "var(--color-error, #ef4444)"
                        : isHigh
                          ? "var(--color-accent, #f59e0b)"
                          : "var(--color-primary, #0d7377)",
                    }}
                  />
                  {/* auto-compact 閾値マーカー */}
                  <div
                    className="absolute top-0 h-full w-px"
                    style={{
                      left: `${compactPercent}%`,
                      background: "var(--color-error, #ef4444)",
                      opacity: 0.5,
                    }}
                    title={`auto-compact (${compactPercent}%)`}
                  />
                </div>
                <span
                  className="text-[10px] font-mono tabular-nums whitespace-nowrap"
                  style={{
                    color: isCritical
                      ? "var(--color-error, #ef4444)"
                      : "var(--foreground-muted)",
                  }}
                >
                  {Math.round(percent)}% ({(contextTokens / 1000).toFixed(0)}k / {CONTEXT_WINDOW / 1000}k)
                </span>
              </div>
            );
          })()}
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        <div className="mx-auto max-w-4xl space-y-4">
          {messages.length === 0 && !isStreaming && (
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
                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                  />
                </svg>
              </div>
              <h3
                className="text-xl font-semibold mb-2"
                style={{ color: "var(--foreground)" }}
              >
                リアルタイム対話
              </h3>
              <p style={{ color: "var(--foreground-secondary)" }}>
                リアルタイムで話しましょう
              </p>
              {!connected && (
                <p
                  className="mt-4 text-sm"
                  style={{ color: "var(--color-error)" }}
                >
                  デーモンに接続できません。daemon が起動しているか確認してください。
                </p>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id}>
              <ChatMessage
                role={msg.role}
                content={msg.content}
              />
              {/* 選択肢ボタン */}
              {msg.choices && msg.questionId && (
                <div className="flex flex-wrap gap-2 mt-3 ml-2 animate-slide-in-left">
                  {msg.choices.map((choice) => (
                    <button
                      key={choice}
                      onClick={() => handleChoice(msg.questionId!, choice)}
                      className="rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:scale-[1.03] active:scale-95"
                      style={{
                        background: "var(--background-elevated)",
                        color: "var(--color-primary)",
                        border: "1.5px solid var(--color-primary)",
                        boxShadow: "var(--shadow-sm)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--color-primary)";
                        e.currentTarget.style.color = "white";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--background-elevated)";
                        e.currentTarget.style.color = "var(--color-primary)";
                      }}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* 思考中インジケーター（speak しなければ静かに消える） */}
          {isStreaming && <ThinkingIndicator />}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 pb-4 pt-2" style={{ background: "var(--background)" }}>
        <div className="mx-auto max-w-4xl">
          <MessageInput
            onSend={handleSend}
            disabled={!connected || isStreaming}
          />
        </div>
      </div>
    </main>
  );
}
