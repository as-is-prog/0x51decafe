/**
 * opencode-engine.ts — OpenCode CLI 呼び出し層
 *
 * OpenCode の `run --format json` 出力（NDJSON）をパースし、
 * CliEngine インターフェースに準拠したコールバック通知を行う。
 *
 * OpenCode JSON イベント形式:
 *   各行が独立した JSON オブジェクト。主なタイプ:
 *   - {"type":"step_start", "part":{...}}    — ステップ開始
 *   - {"type":"text", "part":{"text":"..."}} — テキスト応答
 *   - {"type":"tool_use", "part":{...}}      — ツール使用
 *   - {"type":"step_finish", "part":{...}}   — ステップ終了
 */

import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import type { CliInvokeOptions, CliUsageInfo, CliEngine, CliProcessHandle } from './types.js';

export class OpenCodeEngine implements CliEngine {
  private opencodePath: string;
  private workingDir: string;
  private logFile: string;
  private statusFile?: string;

  constructor({ opencodePath, workingDir, logFile, statusFile }: {
    opencodePath: string;
    workingDir: string;
    logFile: string;
    statusFile?: string;
  }) {
    this.opencodePath = opencodePath;
    this.workingDir = workingDir;
    this.logFile = logFile;
    this.statusFile = statusFile;
  }

  private debugLog(msg: string): void {
    const ts = new Date().toISOString();
    try {
      appendFileSync(this.logFile, `[${ts}] [opencode-engine] ${msg}\n`);
    } catch {
      // ignore
    }
  }

  invoke(options: CliInvokeOptions): CliProcessHandle {
    const args = [
      'run',
      '--format', 'json',
    ];

    if (options.sessionId) {
      args.push('-s', options.sessionId);
    }

    // OpenCode はプロンプトを位置引数として渡す
    args.push(options.prompt);

    // OPENCODE_CONFIG_CONTENT の構築
    const configContent: Record<string, unknown> = {};

    if (this.statusFile) {
      configContent.instructions = [this.statusFile];
    }

    if (options.skipPermissions) {
      configContent.permission = {
        read: 'allow',
        edit: 'allow',
        write: 'allow',
        bash: 'allow',
        glob: 'allow',
        grep: 'allow',
        webfetch: 'allow',
        skill: 'allow',
        task: 'allow',
      };
    } else {
      configContent.tools = {
        bash: true,
        read: true,
        write: true,
        edit: true,
        skill: true,
        webfetch: true,
        task: false,
        glob: false,
        grep: false,
      };
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

    if (Object.keys(configContent).length > 0) {
      env.OPENCODE_CONFIG_CONTENT = JSON.stringify(configContent);
      this.debugLog(`OPENCODE_CONFIG_CONTENT: ${env.OPENCODE_CONFIG_CONTENT}`);
    }

    this.debugLog(`invoke: args=${JSON.stringify(args)}`);

    const child = spawn(this.opencodePath, args, {
      cwd: this.workingDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    child.stdin.end();

    let buffer = '';
    let discoveredSessionId: string | null = null;
    let completed = false;
    let lastTokens: { input: number; output: number } = { input: 0, output: 0 };
    let totalCost = 0;
    let numTurns = 0;

    const processJsonLine = (obj: Record<string, unknown>) => {
      const type = obj.type as string | undefined;
      const sessionID = obj.sessionID as string | undefined;
      const part = obj.part as Record<string, unknown> | undefined;

      // セッションID の発見（全イベントに含まれる）
      if (sessionID && !discoveredSessionId) {
        discoveredSessionId = sessionID;
        this.debugLog(`session_id discovered: ${sessionID}`);
      }

      if (!part) return;

      switch (type) {
        case 'text': {
          const text = part.text as string | undefined;
          if (text) {
            options.onChunk?.(text);
          }
          break;
        }

        case 'step_start': {
          numTurns++;
          break;
        }

        case 'step_finish': {
          const reason = part.reason as string | undefined;
          const tokens = part.tokens as Record<string, unknown> | undefined;
          const cost = part.cost as number | undefined;

          if (tokens) {
            lastTokens = {
              input: typeof tokens.input === 'number' ? tokens.input : 0,
              output: typeof tokens.output === 'number' ? tokens.output : 0,
            };
          }
          if (typeof cost === 'number') {
            totalCost += cost;
          }

          // reason: "stop" が最終終了
          if (reason === 'stop' && !completed) {
            completed = true;
            const usage: CliUsageInfo = {
              inputTokens: lastTokens.input,
              outputTokens: lastTokens.output,
              numTurns,
              totalCostUsd: totalCost,
            };
            this.debugLog(`complete: tokens=${JSON.stringify(lastTokens)}, turns=${numTurns}, cost=$${totalCost.toFixed(4)}`);
            options.onComplete?.(discoveredSessionId, usage);
          }
          break;
        }

        // tool_use は現時点ではパススルー（テキスト出力のみ関心がある）
        default:
          break;
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

      if (buffer.trim()) {
        try {
          const obj = JSON.parse(buffer.trim()) as Record<string, unknown>;
          processJsonLine(obj);
        } catch {
          this.debugLog(`tail parse-fail: ${buffer.trim().slice(0, 200)}`);
        }
        buffer = '';
      }

      if (!completed) {
        completed = true;
        this.debugLog('complete on close (no step_finish/stop event)');
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
