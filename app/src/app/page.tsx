"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PushNotificationSetup } from "@/components/PushNotificationSetup";
import type { InhabitantsResponse } from "@/lib/api";

export default function Home() {
  const [inhabitants, setInhabitants] = useState<InhabitantsResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    fetch("/api/inhabitants")
      .then((res) => res.json())
      .then((data: InhabitantsResponse) => {
        setInhabitants(data);
        const saved = localStorage.getItem("selectedInhabitantId");
        const valid = saved && data.inhabitants.some((i) => i.id === saved);
        setSelectedId(valid ? saved : data.default);
      })
      .catch((err) => {
        console.error("Failed to load inhabitants:", err);
      });
  }, []);

  useEffect(() => {
    if (selectedId) {
      localStorage.setItem("selectedInhabitantId", selectedId);
    }
  }, [selectedId]);

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-12 px-6 py-12 animate-fade-in">
      {/* Subtle background gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[var(--color-primary)] to-transparent" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full opacity-20 blur-3xl bg-gradient-to-tr from-[var(--color-accent)] to-transparent" />
      </div>

      {/* Header */}
      <div className="text-center space-y-3">
        <h1
          className="text-5xl font-bold tracking-tight"
          style={{
            background: 'var(--gradient-primary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          {process.env.NEXT_PUBLIC_APP_NAME || "0x51decafe"}
        </h1>
        <span className="inline-block rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{
          borderColor: 'var(--border-color)',
          color: 'var(--color-primary)',
          background: 'var(--gradient-subtle)'
        }}>
          AI Inhabitant WebUI
        </span>
      </div>

      {/* Inhabitant Selector */}
      {inhabitants && inhabitants.inhabitants.length > 0 && (
        <div className="w-full max-w-sm">
          <label
            htmlFor="inhabitant-select"
            className="block text-sm font-medium mb-2"
            style={{ color: "var(--foreground-secondary)" }}
          >
            インハビタント
          </label>
          <select
            id="inhabitant-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{
              borderColor: "var(--border-color)",
              background: "var(--background-elevated)",
              color: "var(--foreground)",
            }}
          >
            {inhabitants.inhabitants.map((inh) => (
              <option key={inh.id} value={inh.id}>
                {inh.displayName || inh.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Navigation Cards */}
      <div className="grid w-full gap-6 sm:grid-cols-3">
        <Link
          href={selectedId ? `/talk/${selectedId}` : "/talk"}
          className="group relative flex flex-col items-center gap-4 overflow-hidden rounded-2xl border-2 p-8 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-lg"
          style={{
            borderColor: 'var(--border-color)',
            background: 'var(--background-elevated)',
          }}
        >
          <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{
            background: 'linear-gradient(135deg, rgba(var(--color-primary-rgb, 79 70 229), 0.08) 0%, transparent 100%)',
          }} />
          <div className="relative rounded-full p-4" style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
          }}>
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <div className="relative text-center">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>トーク</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--foreground-secondary)' }}>リアルタイム会話</p>
          </div>
        </Link>

        <Link
          href={selectedId ? `/chat/${selectedId}` : "/chat"}
          className="group relative flex flex-col items-center gap-4 overflow-hidden rounded-2xl border-2 p-8 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-lg"
          style={{
            borderColor: 'var(--border-color)',
            background: 'var(--background-elevated)',
          }}
        >
          <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{
            background: 'linear-gradient(135deg, rgba(var(--color-primary-rgb, 79 70 229), 0.08) 0%, transparent 100%)',
          }} />
          <div className="relative rounded-full p-4" style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)',
          }}>
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="relative text-center">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>メッセージ</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--foreground-secondary)' }}>非同期メッセージ</p>
          </div>
        </Link>

        <Link
          href={selectedId ? `/memory/${selectedId}` : "/memory"}
          className="group relative flex flex-col items-center gap-4 overflow-hidden rounded-2xl border-2 p-8 shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-lg"
          style={{
            borderColor: 'var(--border-color)',
            background: 'var(--background-elevated)',
          }}
        >
          <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{
            background: 'linear-gradient(135deg, rgba(var(--color-primary-rgb, 79 70 229), 0.08) 0%, transparent 100%)',
          }} />
          <div className="relative rounded-full p-4" style={{
            background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-primary) 100%)',
          }}>
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="relative text-center">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>記憶</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--foreground-secondary)' }}>メモリビューア</p>
          </div>
        </Link>
      </div>

      {/* Push Notification */}
      <PushNotificationSetup />
    </main>
  );
}
