/**
 * cli-invoker.ts — Claude CLI 呼び出し統一層
 *
 * stream-json 形式の出力をパースし、テキストチャンク・セッションID・完了を通知する。
 *
 * Claude CLI の stream-json 出力形式:
 *   各行が独立した JSON オブジェクト。主なタイプ:
 *   - {"type":"system", ...}          — システム情報（セッションIDを含む）
 *   - {"type":"assistant", "message":{...}, "session_id":"..."}  — 完全なアシスタントメッセージ
 *   - {"type":"assistant", "delta":{"type":"text_delta","text":"..."}, ...} — テキストデルタ
 *   - {"type":"result", ...}          — 実行完了
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import type { CliInvokeOptions, CliUsageInfo, CliEngine, CliProcessHandle } from './types.js';

/**
 * stream-json の各行 JSON からテキストを抽出する。
 * 複数のフォーマットに対応（CLIバージョン差異を吸収）。
 */
function extractText(obj: Record<string, unknown>): string {
  if (!obj) return '';

  // assistant タイプ以外はテキスト抽出しない（system, result 等）
  if (obj.type && obj.type !== 'assistant') return '';

  // パターン1: デルタ形式 {"delta": {"text": "..."}}
  const delta = obj.delta as Record<string, unknown> | undefined;
  if (delta) {
    if (typeof delta.text === 'string') return delta.text;
  }

  // パターン2: message.content 配列形式 {"message": {"content": [{"type":"text","text":"..."}]}}
  const message = obj.message as Record<string, unknown> | undefined;
  if (message?.content && Array.isArray(message.content)) {
    const parts = (message.content as Array<Record<string, unknown>>)
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text as string);
    if (parts.length > 0) return parts.join('\n');
  }

  // パターン3: 直接テキスト {"text": "..."}
  if (typeof obj.text === 'string') return obj.text;

  // パターン4: content 配列が直接ルートにある場合
  if (obj.content && Array.isArray(obj.content)) {
    const parts = (obj.content as Array<Record<string, unknown>>)
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text as string);
    if (parts.length > 0) return parts.join('\n');
  }

  return '';
}

export class ClaudeCliEngine implements CliEngine {
  private claudePath: string;
  private workingDir: string;
  private statusFile: string;
  private logFile: string;

  constructor({ claudePath, workingDir, statusFile, logFile }: { claudePath: string; workingDir: string; statusFile: string; logFile: string }) {
    this.claudePath = claudePath;
    this.workingDir = workingDir;
    this.statusFile = statusFile;
    this.logFile = logFile;
  }

  private debugLog(msg: string): void {
    const ts = new Date().toISOString();
    try {
      appendFileSync(this.logFile, `[${ts}] [cli-invoker] ${msg}\n`);
    } catch {
      // ignore
    }
  }
  /**
   * Claude CLI を起動し、stream-json 出力をパースしながらコールバックで通知する。
   * 返却される ChildProcess を通じてプロセスの制御が可能。
   */
  invoke(options: CliInvokeOptions): CliProcessHandle {
    const args = [
      '-p',
      options.prompt,
      '--output-format',
      'stream-json',
      '--verbose',
      '--append-system-prompt-file',
      this.statusFile,
    ];

    if (options.sessionId) {
      args.push('--resume', options.sessionId);
    }

    if (options.skipPermissions) {
      args.push('--dangerously-skip-permissions');
      args.push('--tools', 'default');
    } else {
      args.push('--tools', 'Bash,Read,Write,Edit,Skill,WebSearch,WebFetch');
    }

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      PATH: [
        `${process.env.HOME}/.local/bin`,
        '/opt/homebrew/bin',
        '/opt/homebrew/sbin',
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin',
        process.env.PATH ?? '',
      ].join(':'),
    };

    // ネストセッション検知を回避（デーモンから起動するCLIは独立セッション）
    delete env.CLAUDECODE;

    this.debugLog(`invoke: args=${JSON.stringify(args)}`);

    const child = spawn(this.claudePath, args, {
      cwd: this.workingDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // stdin を即座に閉じて待ち状態を防ぐ
    child.stdin.end();

    let buffer = '';
    let discoveredSessionId: string | null = null;
    let completed = false;

    // 最後の assistant メッセージの usage を追跡（= 直近 API コールのコンテキスト使用量）
    let lastAssistantInputTokens = 0;

    const processJsonLine = (obj: Record<string, unknown>) => {
      // セッションID の発見
      // system/init と result の session_id を信頼源とする（フックの一時IDより優先）
      if (typeof obj.session_id === 'string') {
        const subtype = obj.subtype as string | undefined;
        const isAuthoritative = obj.type === 'result'
          || (obj.type === 'system' && subtype === 'init');

        if (isAuthoritative || !discoveredSessionId) {
          if (discoveredSessionId !== obj.session_id) {
            this.debugLog(`session_id ${discoveredSessionId ? 'updated' : 'discovered'}: ${obj.session_id} (from ${obj.type}/${subtype ?? '-'})`);
          }
          discoveredSessionId = obj.session_id;
        }
      }

      // assistant メッセージの usage を追跡（直近 API コールのコンテキスト使用量）
      if (obj.type === 'assistant') {
        const message = obj.message as Record<string, unknown> | undefined;
        const msgUsage = message?.usage as Record<string, unknown> | undefined;
        if (msgUsage) {
          lastAssistantInputTokens =
            (typeof msgUsage.input_tokens === 'number' ? msgUsage.input_tokens : 0) +
            (typeof msgUsage.cache_creation_input_tokens === 'number' ? msgUsage.cache_creation_input_tokens : 0) +
            (typeof msgUsage.cache_read_input_tokens === 'number' ? msgUsage.cache_read_input_tokens : 0);
        }
      }

      // result タイプは完了判定
      if (obj.type === 'result') {
        this.debugLog(`result received: ${JSON.stringify(obj).slice(0, 200)}`);
        // result にもテキストが含まれることがある（最終メッセージ）
        const text = extractText(obj);
        if (text) {
          this.debugLog(`text from result: ${text.slice(0, 100)}`);
          options.onChunk?.(text);
        }

        // usage 情報を抽出
        // 直近の assistant メッセージの usage = 実際のコンテキスト使用量
        // result の usage は全ターン累計なのでフォールバックとして使う
        let usage: CliUsageInfo | undefined;
        const rawUsage = obj.usage as Record<string, unknown> | undefined;
        const numTurns = typeof obj.num_turns === 'number' ? obj.num_turns : 1;
        const totalCostUsd = typeof obj.total_cost_usd === 'number' ? obj.total_cost_usd : 0;

        if (lastAssistantInputTokens > 0) {
          // 正確: 最後の assistant メッセージの usage を使用
          const outputTokens = typeof rawUsage?.output_tokens === 'number' ? rawUsage.output_tokens : 0;
          usage = { inputTokens: lastAssistantInputTokens, outputTokens, numTurns, totalCostUsd };
          this.debugLog(`usage: context=${lastAssistantInputTokens}, output=${outputTokens}, turns=${numTurns}, cost=$${totalCostUsd.toFixed(4)}`);
        } else if (rawUsage) {
          // フォールバック: result の累計 usage / numTurns で推定
          const inputTokens =
            (typeof rawUsage.input_tokens === 'number' ? rawUsage.input_tokens : 0) +
            (typeof rawUsage.cache_creation_input_tokens === 'number' ? rawUsage.cache_creation_input_tokens : 0) +
            (typeof rawUsage.cache_read_input_tokens === 'number' ? rawUsage.cache_read_input_tokens : 0);
          const outputTokens = typeof rawUsage.output_tokens === 'number' ? rawUsage.output_tokens : 0;
          const estimatedContext = Math.round(inputTokens / numTurns);
          usage = { inputTokens: estimatedContext, outputTokens, numTurns, totalCostUsd };
          this.debugLog(`usage(fallback): input=${inputTokens}, ~context=${estimatedContext}, turns=${numTurns}, cost=$${totalCostUsd.toFixed(4)}`);
        }

        if (!completed) {
          completed = true;
          options.onComplete?.(discoveredSessionId, usage);
        }
        return;
      }

      // テキスト抽出を試みる
      const text = extractText(obj);
      if (text) {
        options.onChunk?.(text);
      }
    };

    const flushLines = (data: string) => {
      buffer += data;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const obj = JSON.parse(trimmed) as Record<string, unknown>;
          processJsonLine(obj);
        } catch {
          // JSON パース失敗 — デバッグログに記録
          this.debugLog(`parse-fail: ${trimmed.slice(0, 200)}`);
        }
      }
    };

    child.stdout.on('data', (chunk: Buffer) => {
      flushLines(chunk.toString());
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const data = chunk.toString();
      this.debugLog(`stderr: ${data.slice(0, 300)}`);
      options.onError?.(data);
    });

    child.on('close', (code) => {
      this.debugLog(`close: code=${code}, buffer.length=${buffer.length}`);

      // バッファに残りがあれば処理
      if (buffer.trim()) {
        try {
          const obj = JSON.parse(buffer.trim()) as Record<string, unknown>;
          processJsonLine(obj);
        } catch {
          this.debugLog(`tail parse-fail: ${buffer.trim().slice(0, 200)}`);
        }
        buffer = '';
      }

      // close 時点で完了通知がまだなら呼ぶ
      if (!completed) {
        completed = true;
        this.debugLog('complete on close (no result event)');
        options.onComplete?.(discoveredSessionId);
      }
    });

    child.on('error', (err) => {
      this.debugLog(`error: ${err.message}`);
      options.onError?.(err.message);
    });

    return child;
  }
}

/** @deprecated Use ClaudeCliEngine instead */
export const CliInvoker = ClaudeCliEngine;
