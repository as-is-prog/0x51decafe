#!/usr/bin/env node
/**
 * 0x51decafe-daemon CLI
 *
 * デーモンの Unix socket に接続して wake 操作を行う。
 *
 * Usage:
 *   npx tsx cli.ts wake set --time 09:00 --reason "朝"
 *   npx tsx cli.ts wake set --time 09:00 --date 2026-02-15 --reason "朝"
 *   npx tsx cli.ts wake list
 *   npx tsx cli.ts wake cancel --id <uuid>
 *   npx tsx cli.ts wake cancel --all
 *   npx tsx cli.ts wake check [--hours 12]
 */

import { resolve } from 'path';
import { createConnection } from 'net';
import { existsSync } from 'fs';
import { resolveDaemonPaths } from './types.js';
import { loadFrameworkConfig, resolveInhabitantDir } from '../../shared/config-loader.js';

// ----------------------------------------------------------------
// IPC クライアント
// ----------------------------------------------------------------

interface IpcResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
}

function sendRequest(socketPath: string, request: { method: string; params?: Record<string, unknown> }): Promise<IpcResponse> {
  return new Promise((resolve, reject) => {
    if (!existsSync(socketPath)) {
      reject(new Error('デーモンが起動していません。先に daemon start を実行してください。'));
      return;
    }

    const socket = createConnection(socketPath);
    let buffer = '';
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        reject(new Error('リクエストタイムアウト'));
      }
    }, 5000);

    socket.on('connect', () => {
      socket.write(JSON.stringify(request) + '\n');
    });

    socket.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const response = JSON.parse(line) as IpcResponse;
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            socket.end();
            resolve(response);
          }
          return;
        } catch {
          // まだ完全なJSONではない
        }
      }
    });

    socket.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(new Error(`接続エラー: ${err.message}`));
      }
    });

    socket.on('close', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(new Error('接続が閉じられました'));
      }
    });
  });
}

// ----------------------------------------------------------------
// コマンド解析
// ----------------------------------------------------------------

function parseArgs(args: string[]): { command: string; subcommand: string; options: Record<string, string> } {
  const command = args[0] || '';
  const subcommand = args[1] || '';
  const options: Record<string, string> = {};

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1] || '';
      options[key] = value;
      i++;
    }
  }

  return { command, subcommand, options };
}

// ----------------------------------------------------------------
// メイン
// ----------------------------------------------------------------

async function resolveSocketPath(explicitDir?: string): Promise<string> {
  let inhabitantDir: string;
  if (explicitDir) {
    inhabitantDir = resolve(explicitDir);
  } else {
    const fwConfig = await loadFrameworkConfig();
    inhabitantDir = resolveInhabitantDir(fwConfig);
  }
  return resolveDaemonPaths(inhabitantDir).socketPath;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { command, subcommand, options } = parseArgs(args);

  if (command !== 'wake') {
    console.error('Usage: cli.ts wake <set|list|cancel|check> [options]');
    process.exit(1);
  }

  const socketPath = await resolveSocketPath(options['inhabitant-dir']);

  try {
    switch (subcommand) {
      case 'set': {
        const time = options.time;
        const reason = options.reason;
        const date = options.date;

        if (!time || !reason) {
          console.error('Usage: wake set --time HH:MM --reason "理由" [--date YYYY-MM-DD]');
          process.exit(1);
        }

        const params: Record<string, unknown> = { time, reason };
        if (date) params.date = date;

        const response = await sendRequest(socketPath, { method: 'wake.set', params });

        if (response.ok) {
          const result = response.result as Record<string, unknown>;
          console.log(`予約完了: ${result.date} ${result.time}`);
          console.log(`ID: ${result.id}`);
          console.log(`理由: ${result.reason}`);
        } else {
          console.error(`エラー: ${response.error}`);
          process.exit(1);
        }
        break;
      }

      case 'list': {
        const response = await sendRequest(socketPath, { method: 'wake.list' });

        if (response.ok) {
          const result = response.result as { wakes: Array<Record<string, unknown>> };
          if (result.wakes.length === 0) {
            console.log('予約はありません。');
          } else {
            for (const wake of result.wakes) {
              const scheduled = new Date(wake.scheduledAt as string);
              const dateStr = scheduled.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                weekday: 'short',
              });
              const timeStr = scheduled.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              });
              console.log(`[${(wake.id as string).slice(0, 8)}] ${dateStr} ${timeStr} - ${wake.reason}`);
            }
          }
        } else {
          console.error(`エラー: ${response.error}`);
          process.exit(1);
        }
        break;
      }

      case 'cancel': {
        const id = options.id;
        const all = options.all !== undefined;

        if (!id && !all) {
          console.error('Usage: wake cancel --id <uuid> or wake cancel --all');
          process.exit(1);
        }

        const params: Record<string, unknown> = {};
        if (all) {
          params.all = true;
        } else {
          params.id = id;
        }

        const response = await sendRequest(socketPath, { method: 'wake.cancel', params });

        if (response.ok) {
          const result = response.result as { cancelled: number };
          console.log(`${result.cancelled} 件の予約をキャンセルしました。`);
        } else {
          console.error(`エラー: ${response.error}`);
          process.exit(1);
        }
        break;
      }

      case 'check': {
        const hours = options.hours ? parseInt(options.hours, 10) : undefined;
        const params: Record<string, unknown> = {};
        if (hours !== undefined) params.hours = hours;

        const response = await sendRequest(socketPath, { method: 'wake.check', params });

        if (response.ok) {
          const result = response.result as { hasUpcoming: boolean; hoursChecked: number };
          if (result.hasUpcoming) {
            console.log(`${result.hoursChecked}時間以内に予約があります。`);
          } else {
            console.log(`${result.hoursChecked}時間以内に予約はありません。`);
          }
        } else {
          console.error(`エラー: ${response.error}`);
          process.exit(1);
        }
        break;
      }

      default:
        console.error('Usage: cli.ts wake <set|list|cancel|check> [options]');
        process.exit(1);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
