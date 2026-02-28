/**
 * IPC サーバー
 *
 * Unix socket を使用した JSON-RPC ライクなプロトコル。
 * 改行区切り JSON で通信する。
 */

import { createServer, Socket, Server } from 'net';
import { existsSync, unlinkSync } from 'fs';
import type { IpcMethod, IpcRequest, IpcResponse } from './ipc-protocol.js';

// ----------------------------------------------------------------
// ハンドラ型定義
// ----------------------------------------------------------------

/** 通常メソッド用ハンドラ — IpcResponse を返す */
export type IpcHandler = (
  params: Record<string, unknown>,
  socket: Socket,
) => Promise<IpcResponse>;

/** message メソッド用ハンドラ — socket に直接ストリーミング書き込み */
export type IpcStreamHandler = (
  params: Record<string, unknown>,
  socket: Socket,
) => Promise<void>;

/** subscribe メソッド用ハンドラ — 接続を維持してイベントをpush */
export type IpcSubscribeHandler = (
  params: Record<string, unknown>,
  socket: Socket,
) => void;

/** ハンドラマップ。message, subscribe は特殊型 */
export type IpcHandlers = {
  [K in Exclude<IpcMethod, 'message' | 'subscribe'>]?: IpcHandler;
} & {
  message?: IpcStreamHandler;
  subscribe?: IpcSubscribeHandler;
};

// ----------------------------------------------------------------
// IPC サーバー
// ----------------------------------------------------------------

export class IpcServer {
  private server: Server | null = null;
  private handlers: IpcHandlers;
  private socketPath: string;

  constructor(socketPath: string, handlers: IpcHandlers) {
    this.socketPath = socketPath;
    this.handlers = handlers;
  }

  /**
   * サーバーを開始
   */
  async start(): Promise<void> {
    // 古いソケットファイルを削除
    if (existsSync(this.socketPath)) {
      try {
        unlinkSync(this.socketPath);
      } catch {
        // 削除できなくても続行を試みる
      }
    }

    return new Promise((resolve, reject) => {
      this.server = createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(this.socketPath, () => {
        resolve();
      });
    });
  }

  /**
   * サーバーを停止
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          // ソケットファイルを削除
          if (existsSync(this.socketPath)) {
            try {
              unlinkSync(this.socketPath);
            } catch {
              // ignore
            }
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * クライアント接続を処理
   */
  private handleConnection(socket: Socket): void {
    let buffer = '';

    socket.on('data', async (data) => {
      buffer += data.toString();

      // 改行区切りでリクエストを処理
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const request = JSON.parse(line) as IpcRequest;
          await this.handleRequest(request, socket);
        } catch (err) {
          const response: IpcResponse = {
            ok: false,
            error: `Invalid request: ${err instanceof Error ? err.message : String(err)}`,
          };
          socket.write(JSON.stringify(response) + '\n');
        }
      }
    });

    socket.on('error', (err) => {
      console.error('IPC socket error:', err.message);
    });
  }

  /**
   * リクエストをディスパッチ
   */
  private async handleRequest(request: IpcRequest, socket: Socket): Promise<void> {
    const { method, params = {} } = request;

    // message メソッドはストリーミング — socket に直接書き込む
    if (method === 'message') {
      const handler = this.handlers.message;
      if (!handler) {
        const response: IpcResponse = { ok: false, error: `No handler for method: ${method}` };
        socket.write(JSON.stringify(response) + '\n');
        return;
      }

      try {
        await handler(params, socket);
      } catch (err) {
        // ストリーミング中のエラーも改行区切りJSONで返す
        const errorEvent = {
          type: 'error' as const,
          error: err instanceof Error ? err.message : String(err),
        };
        socket.write(JSON.stringify(errorEvent) + '\n');
      }
      return;
    }

    // subscribe メソッドは接続を維持 — socket を登録して終了
    if (method === 'subscribe') {
      const handler = this.handlers.subscribe;
      if (!handler) {
        const response: IpcResponse = { ok: false, error: `No handler for method: ${method}` };
        socket.write(JSON.stringify(response) + '\n');
        return;
      }

      try {
        handler(params, socket);
        // subscribe は接続を維持するため、ここでは終了しない
      } catch (err) {
        const errorEvent = {
          type: 'error' as const,
          error: err instanceof Error ? err.message : String(err),
        };
        socket.write(JSON.stringify(errorEvent) + '\n');
      }
      return;
    }

    // 通常メソッド
    const handler = this.handlers[method];
    if (!handler) {
      const response: IpcResponse = { ok: false, error: `Unknown method: ${method}` };
      socket.write(JSON.stringify(response) + '\n');
      return;
    }

    try {
      const response = await handler(params, socket);
      socket.write(JSON.stringify(response) + '\n');
    } catch (err) {
      const response: IpcResponse = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
      socket.write(JSON.stringify(response) + '\n');
    }
  }
}
