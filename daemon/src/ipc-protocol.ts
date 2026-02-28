/**
 * IPC プロトコル定義
 *
 * JSON-RPC-like、改行区切り。
 * Unix socket 上で通信する。
 */

// ----------------------------------------------------------------
// メソッド定義
// ----------------------------------------------------------------

export type IpcMethod =
  | 'ping'
  | 'message'          // ユーザー入力 → CLI実行（応答はsubscribe経由）
  | 'subscribe'        // CLI出力を購読（接続を維持してイベントをpush）
  | 'presence'         // アプリ開閉通知
  | 'permission.get'   // パーミッションスキップ状態取得
  | 'permission.set'   // パーミッションスキップ状態変更
  | 'wake.set'
  | 'wake.list'
  | 'wake.cancel'
  | 'wake.check'
  | 'status'           // デーモン状態取得
  | 'stop'             // デーモン停止
  | 'reload';          // デーモンリロード（コード再読込、セッション維持）

// ----------------------------------------------------------------
// リクエスト
// ----------------------------------------------------------------

export interface IpcRequest {
  method: IpcMethod;
  params?: Record<string, unknown>;
}

// ----------------------------------------------------------------
// レスポンス（通常）
// ----------------------------------------------------------------

export interface IpcResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
}

// ----------------------------------------------------------------
// ストリーミングレスポンス（messageメソッド用）
// 改行区切りJSONで複数レスポンスを返す
// ----------------------------------------------------------------

/** テキストチャンク */
export interface IpcStreamChunk {
  type: 'chunk';
  text: string;
}

/** ストリーミング完了 */
export interface IpcStreamDone {
  type: 'done';
  session_id: string | null;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    numTurns: number;
    totalCostUsd: number;
  };
}

/** ストリーミングエラー */
export interface IpcStreamError {
  type: 'error';
  error: string;
}

export type IpcStreamEvent = IpcStreamChunk | IpcStreamDone | IpcStreamError;

// ----------------------------------------------------------------
// メソッド別パラメータ型
// ----------------------------------------------------------------

export interface MessageParams {
  text: string;
}

export interface PresenceParams {
  state: 'online' | 'offline';
}

export interface WakeSetParams {
  time: string;       // HH:MM
  reason: string;
  date?: string;      // YYYY-MM-DD
}

export interface WakeCancelParams {
  id?: string;
  all?: boolean;
}

export interface WakeCheckParams {
  hours?: number;     // デフォルト12
}

// ----------------------------------------------------------------
// Subscribe イベント型
// subscribe メソッドで接続を維持し、CLI出力をpushする
// ----------------------------------------------------------------

/** 購読開始の確認 */
export interface IpcSubscribeAck {
  type: 'subscribed';
}

/** CLI出力のテキストチャンク */
export interface IpcSubscribeChunk {
  type: 'chunk';
  text: string;
  source: 'message' | 'timer';  // 発生源（ユーザー入力 or タイマー）
}

/** CLI呼び出し完了 */
export interface IpcSubscribeDone {
  type: 'done';
  session_id: string | null;
  source: 'message' | 'timer';
  usage?: {
    inputTokens: number;
    outputTokens: number;
    numTurns: number;
    totalCostUsd: number;
  };
}

/** エラー発生 */
export interface IpcSubscribeError {
  type: 'error';
  error: string;
  source: 'message' | 'timer';
}

export type IpcSubscribeEvent =
  | IpcSubscribeAck
  | IpcSubscribeChunk
  | IpcSubscribeDone
  | IpcSubscribeError;
