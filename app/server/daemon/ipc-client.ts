/**
 * daemon IPC クライアント
 *
 * Unix socket 経由でデーモンと通信する。
 * - sendRequest: 通常の request/response（ping, presence, status 等）
 * - sendMessage: message メソッド用。ストリーミングレスポンスをコールバックで通知
 * - subscribe: CLI出力を購読。タイマー発火の応答も含む全出力を受信
 */

import { createConnection, type Socket } from "node:net";
import { existsSync } from "node:fs";

// ----------------------------------------------------------------
// 型定義（daemon/src/ipc-protocol.ts と同等）
// ----------------------------------------------------------------

export interface IpcRequest {
  method: string;
  params?: Record<string, unknown>;
}

export interface IpcResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface IpcStreamChunk {
  type: "chunk";
  text: string;
}

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  numTurns: number;
  totalCostUsd: number;
}

export interface IpcStreamDone {
  type: "done";
  session_id: string | null;
  usage?: UsageInfo;
}

export interface IpcStreamError {
  type: "error";
  error: string;
}

type IpcStreamEvent = IpcStreamChunk | IpcStreamDone | IpcStreamError;

// ----------------------------------------------------------------
// Subscribe イベント型
// ----------------------------------------------------------------

export type SubscribeSource = "message" | "timer";

export interface IpcSubscribeAck {
  type: "subscribed";
}

export interface IpcSubscribeChunk {
  type: "chunk";
  text: string;
  source: SubscribeSource;
}

export interface IpcSubscribeDone {
  type: "done";
  session_id: string | null;
  source: SubscribeSource;
  usage?: UsageInfo;
}

export interface IpcSubscribeError {
  type: "error";
  error: string;
  source: SubscribeSource;
}

export type IpcSubscribeEvent =
  | IpcSubscribeAck
  | IpcSubscribeChunk
  | IpcSubscribeDone
  | IpcSubscribeError;

// ----------------------------------------------------------------
// Subscribe コールバック型
// ----------------------------------------------------------------

export interface SubscribeCallbacks {
  onSubscribed?: () => void;
  onChunk: (text: string, source: SubscribeSource) => void;
  onDone: (sessionId: string | null, source: SubscribeSource, usage?: UsageInfo) => void;
  onError: (error: string, source: SubscribeSource) => void;
  onDisconnect?: () => void;
}

// ----------------------------------------------------------------
// Factory function
// ----------------------------------------------------------------

export function createIpcClient(socketPath: string) {
  return {
    sendRequest(
      method: string,
      params?: Record<string, unknown>,
      timeout = 5000
    ): Promise<IpcResponse> {
      return new Promise((resolve, reject) => {
        if (!existsSync(socketPath)) {
          reject(new Error("Daemon is not running (socket not found)"));
          return;
        }

        const socket = createConnection(socketPath);
        let buffer = "";
        let resolved = false;

        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            socket.destroy();
            reject(new Error("Request timeout"));
          }
        }, timeout);

        socket.on("connect", () => {
          const request: IpcRequest = { method, params };
          socket.write(JSON.stringify(request) + "\n");
        });

        socket.on("data", (data) => {
          buffer += data.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

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
              // まだ完全な JSON ではない — 次のデータを待つ
            }
          }
        });

        socket.on("error", (err) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            reject(err);
          }
        });

        socket.on("close", () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            reject(new Error("Connection closed"));
          }
        });
      });
    },

    sendMessage(
      text: string,
      onChunk: (text: string) => void,
      onDone: (sessionId: string | null, usage?: UsageInfo) => void,
      onError: (error: string) => void
    ): { abort: () => void } {
      let socket: Socket | null = null;
      let aborted = false;

      const connect = () => {
        if (!existsSync(socketPath)) {
          onError("Daemon is not running (socket not found)");
          return;
        }

        socket = createConnection(socketPath);
        let buffer = "";

        socket.on("connect", () => {
          const request: IpcRequest = { method: "message", params: { text } };
          socket!.write(JSON.stringify(request) + "\n");
        });

        socket.on("data", (data) => {
          if (aborted) return;

          buffer += data.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line) as IpcStreamEvent;
              switch (event.type) {
                case "chunk":
                  onChunk(event.text);
                  break;
                case "done":
                  onDone(event.session_id, event.usage);
                  socket?.end();
                  break;
                case "error":
                  onError(event.error);
                  socket?.end();
                  break;
              }
            } catch {
              // 不完全な JSON — 無視して次を待つ
            }
          }
        });

        socket.on("error", (err) => {
          if (!aborted) {
            onError(err.message);
          }
        });

        socket.on("close", () => {
          // done/error コールバック後に close が来るのは正常
        });
      };

      connect();

      return {
        abort: () => {
          aborted = true;
          socket?.destroy();
        },
      };
    },

    subscribe(callbacks: SubscribeCallbacks): {
      disconnect: () => void;
      isConnected: () => boolean;
    } {
      let socket: Socket | null = null;
      let connected = false;
      let intentionalDisconnect = false;

      const connect = () => {
        if (!existsSync(socketPath)) {
          callbacks.onError("Daemon is not running (socket not found)", "message");
          return;
        }

        socket = createConnection(socketPath);
        let buffer = "";

        socket.on("connect", () => {
          connected = true;
          const request: IpcRequest = { method: "subscribe" };
          socket!.write(JSON.stringify(request) + "\n");
        });

        socket.on("data", (data) => {
          buffer += data.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line) as IpcSubscribeEvent;
              switch (event.type) {
                case "subscribed":
                  callbacks.onSubscribed?.();
                  break;
                case "chunk":
                  callbacks.onChunk(event.text, event.source);
                  break;
                case "done":
                  callbacks.onDone(event.session_id, event.source, event.usage);
                  break;
                case "error":
                  callbacks.onError(event.error, event.source);
                  break;
              }
            } catch {
              // 不完全な JSON — 無視して次を待つ
            }
          }
        });

        socket.on("error", (err) => {
          console.error("[subscribe] socket error:", err.message);
          connected = false;
        });

        socket.on("close", () => {
          connected = false;
          if (!intentionalDisconnect) {
            callbacks.onDisconnect?.();
          }
        });
      };

      connect();

      return {
        disconnect: () => {
          intentionalDisconnect = true;
          socket?.destroy();
          connected = false;
        },
        isConnected: () => connected,
      };
    },
  };
}

export type IpcClient = ReturnType<typeof createIpcClient>;
