"use client";

import useSWR from "swr";
import { useState, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetcher } from "@/lib/api";

interface MemoryFileInfo {
  path: string;
  name: string;
  directory: string;
  modifiedAt: number;
}

interface MemoryFilesResponse {
  files: MemoryFileInfo[];
}

interface MemoryFileContent {
  path: string;
  content: string;
  modifiedAt: number;
}

export default function MemoryPage() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { data: filesData, isLoading: filesLoading } =
    useSWR<MemoryFilesResponse>("/api/memory", fetcher);

  const { data: fileContent, isLoading: contentLoading } =
    useSWR<MemoryFileContent>(
      selectedFile ? `/api/memory/${selectedFile}` : null,
      fetcher
    );

  const files = filesData?.files ?? [];

  // ディレクトリでグループ化
  const groupedFiles = files.reduce<Record<string, MemoryFileInfo[]>>(
    (acc, file) => {
      const dir = file.directory || "(root)";
      if (!acc[dir]) acc[dir] = [];
      acc[dir].push(file);
      return acc;
    },
    {}
  );

  // 初期選択: short-term.md または最初のファイル
  useEffect(() => {
    if (!selectedFile && files.length > 0) {
      const shortTerm = files.find((f) => f.path === "short-term.md");
      setSelectedFile(shortTerm?.path ?? files[0].path);
    }
  }, [files, selectedFile]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <main className="flex min-h-screen flex-col animate-fade-in">
      {/* Subtle background gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[var(--color-primary)] to-transparent" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full opacity-20 blur-3xl bg-gradient-to-tr from-[var(--color-accent)] to-transparent" />
      </div>

      {/* Header */}
      <header
        className="sticky top-0 z-20 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--border-color)",
          background: "rgba(var(--background-rgb), 0.8)",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 py-4">
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
              記憶
            </h1>
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg transition-colors"
              style={{
                color: "var(--foreground-secondary)",
                background: isMobileMenuOpen
                  ? "var(--background-secondary)"
                  : "transparent",
              }}
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
                  d={
                    isMobileMenuOpen
                      ? "M6 18L18 6M6 6l12 12"
                      : "M4 6h16M4 12h16M4 18h16"
                  }
                />
              </svg>
            </button>
            <div className="hidden md:block w-16" /> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* File list sidebar */}
        <aside
          className={`
            ${isMobileMenuOpen ? "fixed inset-0 top-[65px] z-10 md:relative md:inset-auto" : "hidden md:block"}
            w-full md:w-72 border-r overflow-y-auto flex-shrink-0
          `}
          style={{
            borderColor: "var(--border-color)",
            background: "var(--background)",
          }}
        >
          <div className="p-4 space-y-4">
            {filesLoading && (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
              </div>
            )}

            {!filesLoading && files.length === 0 && (
              <p
                className="text-sm text-center py-8"
                style={{ color: "var(--foreground-secondary)" }}
              >
                記憶ファイルがありません
              </p>
            )}

            {Object.entries(groupedFiles)
              .sort(([a], [b]) => {
                // (root) を先頭に
                if (a === "(root)") return -1;
                if (b === "(root)") return 1;
                return a.localeCompare(b);
              })
              .map(([directory, dirFiles]) => (
                <div key={directory}>
                  <h3
                    className="text-xs font-semibold uppercase tracking-wider mb-2 px-2"
                    style={{ color: "var(--foreground-muted)" }}
                  >
                    {directory === "(root)" ? "ルート" : directory}
                  </h3>
                  <ul className="space-y-1">
                    {dirFiles.map((file) => (
                      <li key={file.path}>
                        <button
                          onClick={() => handleFileSelect(file.path)}
                          className={`
                            w-full text-left px-3 py-2 rounded-lg text-sm
                            transition-all duration-200
                            ${selectedFile === file.path
                              ? "font-medium"
                              : "hover:scale-[1.02]"
                            }
                          `}
                          style={{
                            background:
                              selectedFile === file.path
                                ? "var(--gradient-subtle)"
                                : "transparent",
                            color:
                              selectedFile === file.path
                                ? "var(--color-primary)"
                                : "var(--foreground)",
                            border:
                              selectedFile === file.path
                                ? "1px solid var(--color-primary)"
                                : "1px solid transparent",
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <svg
                              className="h-4 w-4 flex-shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            <span className="truncate">{file.name}</span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </aside>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-3xl">
            {contentLoading && (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
              </div>
            )}

            {!contentLoading && !fileContent && selectedFile && (
              <div
                className="text-center py-12"
                style={{ color: "var(--foreground-secondary)" }}
              >
                <p>ファイルを読み込めませんでした</p>
              </div>
            )}

            {fileContent && (
              <article className="animate-fade-in">
                {/* File header */}
                <div className="mb-6 pb-4 border-b" style={{ borderColor: "var(--border-color)" }}>
                  <h2
                    className="text-2xl font-bold mb-2"
                    style={{ color: "var(--foreground)" }}
                  >
                    {fileContent.path}
                  </h2>
                  <p
                    className="text-sm"
                    style={{ color: "var(--foreground-secondary)" }}
                  >
                    最終更新: {formatDate(fileContent.modifiedAt)}
                  </p>
                </div>

                {/* Markdown content */}
                <div
                  className="rounded-xl p-6 border"
                  style={{
                    background: "var(--background-elevated)",
                    borderColor: "var(--border-color)",
                  }}
                >
                  <div className="prose-chat">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {fileContent.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </article>
            )}

            {!selectedFile && !filesLoading && files.length > 0 && (
              <div
                className="text-center py-12"
                style={{ color: "var(--foreground-secondary)" }}
              >
                <p>ファイルを選択してください</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
