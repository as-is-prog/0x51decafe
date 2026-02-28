/**
 * subscriber-manager.ts --- 購読者管理
 *
 * subscribe 接続を維持しているクライアントを管理し、
 * CLI 出力をブロードキャストする。
 */

import type { Socket } from 'net';
import { appendFileSync } from 'fs';
import type {
  IpcSubscribeAck,
  IpcSubscribeChunk,
  IpcSubscribeDone,
  IpcSubscribeError,
  IpcSubscribeEvent,
} from './ipc-protocol.js';

// ----------------------------------------------------------------
// SubscriberManager
// ----------------------------------------------------------------

export class SubscriberManager {
  private subscribers: Set<Socket> = new Set();
  private logFile: string;
  private _onEmpty: (() => void) | null = null;

  constructor(logFile?: string) {
    this.logFile = logFile ?? '/dev/null';
  }

  /**
   * 全 subscriber がいなくなった時のコールバックを設定する。
   */
  onEmpty(callback: () => void): void {
    this._onEmpty = callback;
  }

  private debugLog(msg: string): void {
    const ts = new Date().toISOString();
    try {
      appendFileSync(this.logFile, `[${ts}] [subscriber-manager] ${msg}\n`);
    } catch {
      // ignore
    }
  }

  /**
   * 購読者を追加する。
   */
  add(socket: Socket): void {
    this.subscribers.add(socket);
    this.debugLog(`subscriber added: count=${this.subscribers.size}`);

    // 接続確認イベントを送信
    const ack: IpcSubscribeAck = { type: 'subscribed' };
    this.send(socket, ack);

    // 切断時に自動削除
    socket.on('close', () => {
      this.remove(socket);
    });

    socket.on('error', () => {
      this.remove(socket);
    });
  }

  /**
   * 購読者を削除する。
   */
  remove(socket: Socket): void {
    if (this.subscribers.delete(socket)) {
      this.debugLog(`subscriber removed: count=${this.subscribers.size}`);
      if (this.subscribers.size === 0 && this._onEmpty) {
        this.debugLog('all subscribers gone, firing onEmpty');
        this._onEmpty();
      }
    }
  }

  /**
   * 購読者数を取得する。
   */
  count(): number {
    return this.subscribers.size;
  }

  /**
   * 全購読者にイベントを送信する。
   */
  broadcast(event: IpcSubscribeEvent): void {
    const json = JSON.stringify(event) + '\n';

    for (const socket of this.subscribers) {
      try {
        if (!socket.destroyed) {
          socket.write(json);
        }
      } catch (err) {
        this.debugLog(`broadcast error: ${err}`);
        this.remove(socket);
      }
    }
  }

  /**
   * チャンクをブロードキャストする。
   */
  broadcastChunk(text: string, source: 'message' | 'timer'): void {
    const event: IpcSubscribeChunk = { type: 'chunk', text, source };
    this.broadcast(event);
  }

  /**
   * 完了をブロードキャストする。
   */
  broadcastDone(
    sessionId: string | null,
    source: 'message' | 'timer',
    usage?: {
      inputTokens: number;
      outputTokens: number;
      numTurns: number;
      totalCostUsd: number;
    },
  ): void {
    const event: IpcSubscribeDone = {
      type: 'done',
      session_id: sessionId,
      source,
      usage,
    };
    this.broadcast(event);
  }

  /**
   * エラーをブロードキャストする。
   */
  broadcastError(error: string, source: 'message' | 'timer'): void {
    const event: IpcSubscribeError = { type: 'error', error, source };
    this.broadcast(event);
  }

  /**
   * 単一ソケットにイベントを送信する。
   */
  private send(socket: Socket, event: IpcSubscribeEvent): void {
    try {
      if (!socket.destroyed) {
        socket.write(JSON.stringify(event) + '\n');
      }
    } catch {
      // ignore
    }
  }

  /**
   * 全購読者をクリアする。
   */
  clear(): void {
    this.subscribers.clear();
    this.debugLog('all subscribers cleared');
  }
}
