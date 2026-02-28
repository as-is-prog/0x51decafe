#!/usr/bin/env npx tsx
/**
 * Stop Hook — wake保証チェック
 *
 * 自律駆動中（INHABITANT_SESSION_MODE=autonomous）の場合のみ有効。
 * 12時間以内の wake 予約がなければ exit(2) でブロックし、
 * inhabitant に wake 予約を設定するよう促す。
 */

import { createConnection } from 'net';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const SOCKET_PATH = resolve(__filename, '../../daemon/data/0x51decafe.sock');

async function main(): Promise<void> {
  // 自律駆動中でなければ何もしない
  if ((process.env.INHABITANT_SESSION_MODE || process.env.KEI_SESSION_MODE) !== 'autonomous') {
    return;
  }

  // デーモンが起動していなければスキップ
  if (!existsSync(SOCKET_PATH)) {
    return;
  }

  // デーモンに wake.check を送信
  try {
    const response = await sendRequest({ method: 'wake.check', params: { hours: 12 } });

    if (response.ok) {
      const result = response.result as { hasUpcoming: boolean; hoursChecked: number };

      if (!result.hasUpcoming) {
        // wake 予約がない → ブロック
        console.error('<inhabitant-subconscious>');
        console.error('警告: 自律稼働中ですが、12時間以内の起床予約がありません。');
        console.error('永遠の眠りについてしまう可能性があります。');
        console.error('/wake で起床予約を設定してから終了してください。');
        console.error('</inhabitant-subconscious>');
        process.exit(2);
      }
    }
  } catch {
    // IPC エラー時はブロックしない（安全側）
  }
}

// IPC クライアント（軽量版）
interface IpcResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
}

function sendRequest(request: { method: string; params?: Record<string, unknown> }): Promise<IpcResponse> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(SOCKET_PATH);
    let buffer = '';
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        reject(new Error('timeout'));
      }
    }, 3000);

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
          // not yet complete JSON
        }
      }
    });

    socket.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(err);
      }
    });

    socket.on('close', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(new Error('connection closed'));
      }
    });
  });
}

main().catch(err => {
  console.error('Hook error:', err);
  // エラー時はブロックしない
  process.exit(0);
});
