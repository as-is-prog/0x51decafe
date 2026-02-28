/**
 * presence-manager.ts --- プレゼンス管理 + タイマーシステム
 *
 * ユーザーの接続状態を追跡し、タイマーに基づいて CLI を自動呼び出しする。
 *
 * - 沈黙タイマー: アプリ起動中 + N分無言 -> コンパニオンが話しかける
 * - オフラインタイマー: アプリ閉 + N分 + wake予約なし -> 寝る宣言 + wake予約促し
 */

import { appendFileSync } from 'node:fs';
import type { PresenceInfo, PresenceState, CliInvokeOptions, CliEngine, CliProcessHandle } from './types.js';
import type { SessionManager } from './session-manager.js';
import type { StatusWriter } from './status-writer.js';
import type { Scheduler } from './scheduler.js';
import type { SubscriberManager } from './subscriber-manager.js';

/** 沈黙タイマーのデフォルト: 3分 */
const DEFAULT_SILENCE_TIMEOUT_MS = 3 * 60 * 1000;

/** オフラインタイマーのデフォルト: 30分 */
const DEFAULT_OFFLINE_TIMEOUT_MS = 30 * 60 * 1000;

// ----------------------------------------------------------------
// 型定義
// ----------------------------------------------------------------

export interface PresenceManagerDeps {
  cliInvoker: CliEngine;
  sessionManager: SessionManager;
  statusWriter: StatusWriter;
  scheduler: Scheduler;
  subscriberManager: SubscriberManager;
}

export interface PresenceManagerConfig {
  silenceTimeoutMs: number;
  offlineTimeoutMs: number;
}

// ----------------------------------------------------------------
// PresenceManager
// ----------------------------------------------------------------

export class PresenceManager {
  private deps: PresenceManagerDeps;
  private config: PresenceManagerConfig;
  private ownerName: string;
  private logFile: string;

  // プレゼンス状態
  private state: PresenceState = 'offline';
  private since: string;
  private lastMessageAt: string | null = null;

  // タイマー
  private silenceTimer: NodeJS.Timeout | null = null;
  private offlineTimer: NodeJS.Timeout | null = null;

  // CLI呼び出し中フラグ（外部の message ハンドラと共有）
  private cliRunning = false;

  constructor(
    deps: PresenceManagerDeps,
    { ownerName, logFile }: { ownerName: string; logFile: string },
    config?: Partial<PresenceManagerConfig>,
  ) {
    this.deps = deps;
    this.ownerName = ownerName;
    this.logFile = logFile;
    this.since = new Date().toISOString();
    this.config = {
      silenceTimeoutMs: config?.silenceTimeoutMs ?? DEFAULT_SILENCE_TIMEOUT_MS,
      offlineTimeoutMs: config?.offlineTimeoutMs ?? DEFAULT_OFFLINE_TIMEOUT_MS,
    };

    this.debugLog(
      `initialized: silence=${this.config.silenceTimeoutMs}ms, offline=${this.config.offlineTimeoutMs}ms`,
    );
  }

  private debugLog(msg: string): void {
    const ts = new Date().toISOString();
    try {
      appendFileSync(this.logFile, `[${ts}] [presence-manager] ${msg}\n`);
    } catch {
      // ignore
    }
  }

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------

  /**
   * 現在のプレゼンス情報を取得する。
   */
  getPresence(): PresenceInfo {
    return {
      state: this.state,
      since: this.since,
      lastMessageAt: this.lastMessageAt,
    };
  }

  /**
   * プレゼンス状態を変更する（talk-handler の connect/disconnect から呼ばれる）。
   */
  setPresence(newState: PresenceState): void {
    const prev = this.state;
    this.state = newState;
    this.since = new Date().toISOString();

    this.debugLog(`setPresence: ${prev} -> ${newState}`);

    if (newState === 'online') {
      // オフラインタイマーをクリア
      this.clearOfflineTimer();
      // 沈黙タイマーを開始
      this.startSilenceTimer();
    } else {
      // offline
      // 沈黙タイマーをクリア
      this.clearSilenceTimer();
      // オフラインタイマーを開始
      this.startOfflineTimer();
    }

    this.updateStatus();
  }

  /**
   * メッセージ送受信時に呼ばれる。
   * lastMessageAt を更新し、online なら沈黙タイマーをリセット。
   */
  onMessage(): void {
    this.lastMessageAt = new Date().toISOString();

    if (this.state === 'online') {
      this.startSilenceTimer();
    }

    this.updateStatus();
  }

  /**
   * CLI呼び出し中フラグを設定する（message ハンドラから呼ばれる）。
   */
  setCliRunning(running: boolean): void {
    this.cliRunning = running;
    this.debugLog(`setCliRunning: ${running}`);
  }

  /**
   * CLI呼び出し中かどうかを返す。
   */
  isCliRunning(): boolean {
    return this.cliRunning;
  }

  /**
   * セッションローテーションを試みる。
   * 0時以降（JST）かつ未ローテーションの場合に実行。
   *
   * 流れ:
   * 1. sessionManager.shouldRotate() チェック
   * 2. 旧セッションに要約プロンプトを送信
   * 3. 要約テキストを取得
   * 4. セッションIDをクリア
   * 5. 要約を初回プロンプトとして新セッション開始
   * 6. 新セッションID取得 → 保存
   * 7. markRotated()
   */
  async tryRotateSession(): Promise<void> {
    if (!this.deps.sessionManager.shouldRotate()) return;

    this.debugLog('Starting session rotation...');

    const oldSessionId = this.deps.sessionManager.getSessionId();
    if (!oldSessionId) return;

    // Step 1: 旧セッションに要約を依頼
    const summaryPrompt =
      '<inhabitant-session-rotation action="summarize">日付が変わりました。セッションが切り替わります。\n\n1. memory/short-term.md を更新してください\n2. このセッションの要約を200文字程度で作成してください</inhabitant-session-rotation>';

    this.cliRunning = true;
    const summary = await this.invokeCliAndGetText(summaryPrompt, oldSessionId);
    this.cliRunning = false;

    if (!summary) {
      this.debugLog('Failed to get summary, skipping rotation');
      return;
    }

    this.debugLog(`Got summary: ${summary.slice(0, 100)}...`);

    // Step 2: セッションIDをクリア
    this.deps.sessionManager.clearSession();

    // Step 3: 要約を初回プロンプトとして新セッション開始
    const initPrompt = `<inhabitant-session-rotation action="start">\n前のセッションの要約:\n${summary}\n\n新しいセッションが始まりました。\n</inhabitant-session-rotation>`;

    this.cliRunning = true;
    const newSessionId = await this.invokeCliAndGetSessionId(initPrompt);
    this.cliRunning = false;

    if (newSessionId) {
      this.deps.sessionManager.updateSessionId(newSessionId);
      this.debugLog(`Session rotated: new session ${newSessionId}`);
    }

    // Step 4: ローテーション日付を記録
    this.deps.sessionManager.markRotated();

    this.debugLog('Session rotation completed');
  }

  /**
   * 全タイマーを停止する。
   */
  stop(): void {
    this.clearSilenceTimer();
    this.clearOfflineTimer();
    this.debugLog('stopped');
  }

  // ----------------------------------------------------------------
  // Private: タイマー管理
  // ----------------------------------------------------------------

  /**
   * 沈黙タイマーを（再）開始する。
   * 既存のタイマーがあればクリアしてからスタート。
   */
  private startSilenceTimer(): void {
    this.clearSilenceTimer();

    this.silenceTimer = setTimeout(() => {
      this.onSilenceTimeout();
    }, this.config.silenceTimeoutMs);

    this.debugLog(`silence timer started: ${this.config.silenceTimeoutMs}ms`);
  }

  /**
   * 沈黙タイマーをクリアする。
   */
  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  /**
   * オフラインタイマーを開始する。
   */
  private startOfflineTimer(): void {
    this.clearOfflineTimer();

    this.offlineTimer = setTimeout(() => {
      this.onOfflineTimeout();
    }, this.config.offlineTimeoutMs);

    this.debugLog(`offline timer started: ${this.config.offlineTimeoutMs}ms`);
  }

  /**
   * オフラインタイマーをクリアする。
   */
  private clearOfflineTimer(): void {
    if (this.offlineTimer) {
      clearTimeout(this.offlineTimer);
      this.offlineTimer = null;
    }
  }

  // ----------------------------------------------------------------
  // Private: タイマー発火
  // ----------------------------------------------------------------

  /**
   * 沈黙タイマー発火 (online + N分無言)。
   * CLI を呼び出してコンパニオンに話しかけさせる。
   */
  private async onSilenceTimeout(): Promise<void> {
    this.debugLog('silence timeout fired');

    // CLI呼び出し中なら発火をスキップし、タイマーを再スタート
    if (this.cliRunning) {
      this.debugLog('CLI is running, skipping silence trigger and restarting timer');
      this.startSilenceTimer();
      return;
    }

    // 状態が online でなければ無視
    if (this.state !== 'online') {
      this.debugLog('state is not online, ignoring silence timeout');
      return;
    }

    // status.md を更新
    this.updateStatus();

    const minutes = Math.round(this.config.silenceTimeoutMs / 60000);
    const prompt = `<inhabitant-silence-timeout minutes="${minutes}">${this.ownerName}がアプリを開いたまま${minutes}分経過しました。</inhabitant-silence-timeout>`;

    this.invokeCliForTimer(prompt, () => {
      // 完了後、沈黙タイマーを再スタート（online の場合のみ）
      if (this.state === 'online') {
        this.startSilenceTimer();
      }
    });
  }

  /**
   * オフラインタイマー発火 (offline + N分)。
   * wake予約がなければ CLI を呼び出して寝る宣言を促す。
   */
  private async onOfflineTimeout(): Promise<void> {
    this.debugLog('offline timeout fired');

    // CLI呼び出し中なら発火をスキップ（再スタートしない: 一回きり）
    if (this.cliRunning) {
      this.debugLog('CLI is running, skipping offline trigger');
      return;
    }

    // 状態が offline でなければ無視
    if (this.state !== 'offline') {
      this.debugLog('state is not offline, ignoring offline timeout');
      return;
    }

    // wake予約を確認（12時間以内）
    try {
      const hasWake = await this.deps.scheduler.hasUpcoming(12);
      if (hasWake) {
        this.debugLog('wake reservation exists, skipping offline trigger');
        return;
      }
    } catch (err) {
      this.debugLog(`scheduler.hasUpcoming error: ${err}`);
      // エラーでも続行（安全側: 呼び出す）
    }

    // status.md を更新
    this.updateStatus();

    const minutes = Math.round(this.config.offlineTimeoutMs / 60000);
    const prompt = `<inhabitant-offline-timeout minutes="${minutes}">${this.ownerName}がオフラインになって${minutes}分経過しました。12時間以内のwake予約がありません。</inhabitant-offline-timeout>`;

    // 一回きり: 完了後にタイマーを再スタートしない
    this.invokeCliForTimer(prompt, () => {
      this.debugLog('offline CLI invoke completed (no restart)');
    });
  }

  // ----------------------------------------------------------------
  // Private: CLI呼び出しヘルパー
  // ----------------------------------------------------------------

  /**
   * タイマー発火時の CLI 呼び出し共通処理。
   */
  private invokeCliForTimer(prompt: string, onDone: () => void): void {
    this.cliRunning = true;

    const sessionId = this.deps.sessionManager.getSessionId() ?? undefined;

    const options: CliInvokeOptions = {
      prompt,
      sessionId,
      onChunk: (text: string) => {
        // タイマー起動の CLI 出力を全subscriberにブロードキャスト
        this.deps.subscriberManager.broadcastChunk(text, 'timer');
      },
      onComplete: (newSessionId: string | null, usage) => {
        if (newSessionId) {
          this.deps.sessionManager.updateSessionId(newSessionId);
        }
        // subscriberにブロードキャスト
        this.deps.subscriberManager.broadcastDone(newSessionId, 'timer', usage);
        this.cliRunning = false;
        this.debugLog(`timer CLI invoke completed: sessionId=${newSessionId}`);
        onDone();
      },
      onError: (error: string) => {
        // subscriberにブロードキャスト
        this.deps.subscriberManager.broadcastError(error, 'timer');
        this.debugLog(`timer CLI invoke error: ${error}`);
      },
    };

    this.debugLog(`invoking CLI for timer: prompt="${prompt.slice(0, 60)}..."`);

    const child: CliProcessHandle = this.deps.cliInvoker.invoke(options);

    // プロセスが close しても onComplete が呼ばれない場合のフォールバック
    child.on('close', () => {
      if (this.cliRunning) {
        // onComplete がまだ呼ばれていない場合
        this.cliRunning = false;
        this.debugLog('timer CLI process closed without onComplete');
        onDone();
      }
    });

    child.on('error', (err) => {
      this.cliRunning = false;
      this.debugLog(`timer CLI process error: ${err.message}`);
      onDone();
    });
  }

  // ----------------------------------------------------------------
  // Private: status.md 更新
  // ----------------------------------------------------------------

  /**
   * StatusWriter に現在のプレゼンスを書き出す。
   */
  private updateStatus(): void {
    this.deps.statusWriter.update(this.getPresence());
  }

  // ----------------------------------------------------------------
  // Private: ローテーション用 CLI ヘルパー
  // ----------------------------------------------------------------

  /**
   * CLI を呼び出してテキスト応答を取得する（Promise版）。
   */
  private invokeCliAndGetText(prompt: string, sessionId?: string): Promise<string> {
    return new Promise((resolve) => {
      let text = '';
      let resolved = false;

      const options: CliInvokeOptions = {
        prompt,
        sessionId,
        onChunk: (chunk: string) => {
          text += chunk;
        },
        onComplete: () => {
          if (!resolved) {
            resolved = true;
            resolve(text.trim());
          }
        },
        onError: () => {
          if (!resolved) {
            resolved = true;
            resolve('');
          }
        },
      };

      this.updateStatus();

      const child = this.deps.cliInvoker.invoke(options);

      child.on('close', () => {
        if (!resolved) {
          resolved = true;
          resolve(text.trim());
        }
      });

      child.on('error', () => {
        if (!resolved) {
          resolved = true;
          resolve('');
        }
      });
    });
  }

  /**
   * CLI を呼び出して新セッションIDを取得する（resume なし）。
   */
  private invokeCliAndGetSessionId(prompt: string): Promise<string | null> {
    return new Promise((resolve) => {
      let sessionId: string | null = null;
      let resolved = false;

      const options: CliInvokeOptions = {
        prompt,
        // sessionId なし → 新セッション
        onChunk: () => { },
        onComplete: (sid: string | null) => {
          sessionId = sid;
          if (!resolved) {
            resolved = true;
            resolve(sessionId);
          }
        },
        onError: () => {
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        },
      };

      this.updateStatus();

      const child = this.deps.cliInvoker.invoke(options);

      child.on('close', () => {
        if (!resolved) {
          resolved = true;
          resolve(sessionId);
        }
      });

      child.on('error', () => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      });
    });
  }
}
