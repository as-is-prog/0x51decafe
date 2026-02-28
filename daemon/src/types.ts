/**
 * 0x51decafe-daemon 共通型定義
 */

import { resolve } from 'path';

// ----------------------------------------------------------------
// パス定義
// ----------------------------------------------------------------

export const CLAUDE_PATH = process.env.CLAUDE_PATH || 'claude';
export const OPENCODE_PATH = process.env.OPENCODE_PATH || 'opencode';

/** 使用する CLI エンジン。環境変数 CLI_ENGINE で切替可能 */
export type CliEngineType = 'claude-cli' | 'opencode';
export const CLI_ENGINE_TYPE: CliEngineType =
  (process.env.CLI_ENGINE as CliEngineType) || 'claude-cli';

export interface DaemonPaths {
  dataDir: string;      // <inhabitantDir>/.daemon/
  socketPath: string;
  pidFile: string;
  logFile: string;
  sessionFile: string;
  statusFile: string;
  wakesFile: string;
}

export function resolveDaemonPaths(inhabitantDir: string): DaemonPaths {
  const dataDir = resolve(inhabitantDir, '.daemon');
  return {
    dataDir,
    socketPath: resolve(dataDir, '0x51decafe.sock'),
    pidFile: resolve(dataDir, '0x51decafe.pid'),
    logFile: resolve(dataDir, 'daemon.log'),
    sessionFile: resolve(dataDir, 'session.json'),
    statusFile: resolve(dataDir, 'status.md'),
    wakesFile: resolve(dataDir, 'wakes.json'),
  };
}

// ----------------------------------------------------------------
// Wake 関連
// ----------------------------------------------------------------

export interface WakeSchedule {
  id: string;
  scheduledAt: string;      // ISO8601 - 起動予定日時
  reason: string;
  createdAt: string;        // ISO8601
  status: 'pending' | 'triggered' | 'cancelled';
}

export interface WakesData {
  version: 1;
  wakes: WakeSchedule[];
}

// ----------------------------------------------------------------
// セッション関連
// ----------------------------------------------------------------

export interface SessionData {
  sessionId: string | null;
  updatedAt: string;        // ISO8601
  lastRotationDate?: string; // YYYY-MM-DD (JST) — セッションローテーション実行日
}

// ----------------------------------------------------------------
// プレゼンス関連
// ----------------------------------------------------------------

export type PresenceState = 'online' | 'offline';

export interface PresenceInfo {
  state: PresenceState;
  since: string;            // ISO8601
  lastMessageAt: string | null;  // ISO8601
}

// ----------------------------------------------------------------
// デーモン状態
// ----------------------------------------------------------------

export interface DaemonStatus {
  running: boolean;
  pid?: number;
  socketPath: string;
  sessionId: string | null;
  presence: PresenceInfo;
  uptime: number;           // ms
}

// ----------------------------------------------------------------
// CLI呼び出し関連
// ----------------------------------------------------------------

/** CLI result の usage 情報 */
export interface CliUsageInfo {
  inputTokens: number;       // コンテキスト使用量（直近 assistant の usage、またはフォールバック推定値）
  outputTokens: number;      // 出力トークン数（全ターン累計）
  numTurns: number;          // ターン数
  totalCostUsd: number;      // 合計コスト (USD)
}

export interface CliInvokeOptions {
  prompt: string;
  sessionId?: string;
  skipPermissions?: boolean;
  onChunk?: (text: string) => void;
  onComplete?: (sessionId: string | null, usage?: CliUsageInfo) => void;
  onError?: (error: string) => void;
}

// ----------------------------------------------------------------
// CLI エンジン抽象化
// ----------------------------------------------------------------

/** CLI プロセスの制御ハンドル */
export interface CliProcessHandle {
  /** プロセスを終了する */
  kill(signal?: NodeJS.Signals): boolean;
  /** close イベントのリスナー登録 */
  on(event: 'close', listener: (code: number | null) => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
}

/**
 * CLI エンジン抽象インターフェース
 *
 * Claude CLI / OpenCode 等の AI コーディングアシスタント CLI を
 * 統一的に呼び出すためのインターフェース。
 */
export interface CliEngine {
  invoke(options: CliInvokeOptions): CliProcessHandle;
}

export interface CliStreamChunk {
  type: 'chunk';
  text: string;
}

export interface CliStreamDone {
  type: 'done';
  sessionId: string | null;
}

export type CliStreamEvent = CliStreamChunk | CliStreamDone;
