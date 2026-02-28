'use client';

import { useState, useCallback } from 'react';

interface TerminalControlsProps {
  onInput: (data: string) => void;
  onSavePrompt?: (prompt: string) => void;
  disabled?: boolean;
}

// ANSI escape sequences
const KEY_MAP = {
  Escape: '\x1b',
  ArrowUp: '\x1b[A',
  ArrowDown: '\x1b[B',
  Enter: '\r',
} as const;

type Mode = 'input' | 'keys';

export function TerminalControls({ onInput, onSavePrompt, disabled }: TerminalControlsProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<Mode>('input');

  const sendKey = useCallback((key: keyof typeof KEY_MAP) => {
    if (disabled) return;
    onInput(KEY_MAP[key]);
  }, [onInput, disabled]);

  const sendText = useCallback(() => {
    if (disabled || !text.trim()) return;
    const prompt = text.trim();
    onInput(prompt + '\r');
    onSavePrompt?.(prompt);
    setText('');
  }, [text, onInput, onSavePrompt, disabled]);

  const buttonBase = `
    flex items-center justify-center
    rounded-lg border px-3 py-2
    text-sm font-medium
    transition-all duration-150
    active:scale-95
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const keyButton = `
    ${buttonBase}
    min-w-[44px] h-[44px]
    border-slate-300 bg-slate-100 text-slate-700
    hover:bg-slate-200 hover:border-slate-400
    dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200
    dark:hover:bg-slate-700 dark:hover:border-slate-500
  `;

  const sendButton = `
    ${buttonBase}
    px-4 h-[44px]
    border-blue-500 bg-blue-500 text-white
    hover:bg-blue-600 hover:border-blue-600
    dark:border-blue-600 dark:bg-blue-600
    dark:hover:bg-blue-500 dark:hover:border-blue-500
  `;

  const toggleButton = `
    ${buttonBase}
    min-w-[44px] h-[44px]
    border-slate-300 text-slate-700
    dark:border-slate-600 dark:text-slate-200
  `;

  return (
    <div className="flex items-center gap-2 rounded-2xl border p-3 shadow-sm backdrop-blur border-slate-200/80 bg-white/70 dark:border-slate-700/80 dark:bg-slate-900/70">
      {/* モード切替ボタン */}
      <button
        type="button"
        onClick={() => setMode(mode === 'input' ? 'keys' : 'input')}
        className={`${toggleButton} ${
          mode === 'keys'
            ? 'bg-amber-100 border-amber-400 dark:bg-amber-900/50 dark:border-amber-600'
            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'
        }`}
        title={mode === 'input' ? 'キーパネルに切替' : '入力モードに切替'}
      >
        {mode === 'input' ? (
          // キーボードアイコン
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path fillRule="evenodd" d="M3.5 5A2.5 2.5 0 0 0 1 7.5v5A2.5 2.5 0 0 0 3.5 15h13a2.5 2.5 0 0 0 2.5-2.5v-5A2.5 2.5 0 0 0 16.5 5h-13ZM5 7.75a.75.75 0 0 0 0 1.5h.5a.75.75 0 0 0 0-1.5H5Zm2.75.75a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5H8.5a.75.75 0 0 1-.75-.75Zm3.75-.75a.75.75 0 0 0 0 1.5h.5a.75.75 0 0 0 0-1.5h-.5Zm2.75.75a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5H15a.75.75 0 0 1-.75-.75ZM5 10.75a.75.75 0 0 0 0 1.5h10a.75.75 0 0 0 0-1.5H5Z" clipRule="evenodd" />
          </svg>
        ) : (
          // テキスト入力アイコン
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
            <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
          </svg>
        )}
      </button>

      {mode === 'keys' ? (
        /* キーパネルモード */
        <div className="flex flex-1 items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => sendKey('Escape')}
            disabled={disabled}
            className={keyButton}
            title="Escape"
          >
            ESC
          </button>
          <button
            type="button"
            onClick={() => sendKey('ArrowUp')}
            disabled={disabled}
            className={keyButton}
            title="上矢印"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => sendKey('ArrowDown')}
            disabled={disabled}
            className={keyButton}
            title="下矢印"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => sendKey('Enter')}
            disabled={disabled}
            className={keyButton}
            title="Enter"
          >
            Enter
          </button>
        </div>
      ) : (
        /* 通常入力モード */
        <div className="flex flex-1 items-center gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={disabled}
            placeholder="メッセージを入力..."
            rows={1}
            className="
              flex-1 rounded-lg border px-3 py-2 min-h-[44px] max-h-[120px] resize-none
              text-sm
              border-slate-300 bg-white text-slate-900
              placeholder:text-slate-400
              focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20
              disabled:opacity-50 disabled:cursor-not-allowed
              dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100
              dark:placeholder:text-slate-500
              dark:focus:border-blue-400 dark:focus:ring-blue-400/20
            "
          />
          <button
            type="button"
            onClick={sendText}
            disabled={disabled || !text.trim()}
            className={sendButton}
          >
            送信
          </button>
        </div>
      )}
    </div>
  );
}
