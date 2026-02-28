/**
 * Scheduler クラス
 *
 * setTimeout ベースのタイマー管理を行う。
 * 予約発火時に CliEngine / spawn 経由で claude CLI を起動する。
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import type { WakeSchedule, WakesData, DaemonPaths, CliEngine, CliInvokeOptions } from './types.js';
import { SessionManager } from './session-manager.js';
import { StatusWriter } from './status-writer.js';
import { nowISO, formatDate, formatTime } from './utils.js';

const MAX_TIMEOUT = 2147483647; // ~24.8 days in ms (2^31 - 1)
const CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour in ms

// ----------------------------------------------------------------
// Scheduler
// ----------------------------------------------------------------

export interface SchedulerOptions {
  onWakeTriggered?: (wake: WakeSchedule) => void;
  onError?: (error: Error) => void;
}

export class Scheduler {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private intervalChecker: NodeJS.Timeout | null = null;
  private options: SchedulerOptions;
  private sessionManager: SessionManager;
  private statusWriter: StatusWriter;
  private cliEngine: CliEngine;
  private paths: DaemonPaths;
  private workingDir: string;

  constructor(
    sessionManager: SessionManager,
    statusWriter: StatusWriter,
    cliEngine: CliEngine,
    { paths, workingDir }: { paths: DaemonPaths; workingDir: string },
    options: SchedulerOptions = {},
  ) {
    this.sessionManager = sessionManager;
    this.statusWriter = statusWriter;
    this.cliEngine = cliEngine;
    this.paths = paths;
    this.workingDir = workingDir;
    this.options = options;
  }

  private async ensureDataDir(): Promise<void> {
    if (!existsSync(this.paths.dataDir)) {
      await mkdir(this.paths.dataDir, { recursive: true });
    }
  }

  private async loadWakes(): Promise<WakesData> {
    await this.ensureDataDir();
    try {
      const content = await readFile(this.paths.wakesFile, 'utf-8');
      return JSON.parse(content) as WakesData;
    } catch {
      return { version: 1, wakes: [] };
    }
  }

  private async saveWakes(data: WakesData): Promise<void> {
    await this.ensureDataDir();
    await writeFile(this.paths.wakesFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * スケジューラを開始する
   * 既存の予約を復旧し、定期チェックを開始
   */
  async start(): Promise<void> {
    await this.restore();
    this.startIntervalChecker();
  }

  /**
   * スケジューラを停止する
   * 全てのタイマーをクリア
   */
  stop(): void {
    // 全タイマーをクリア
    for (const timerId of this.timers.values()) {
      clearTimeout(timerId);
    }
    this.timers.clear();

    // インターバルチェッカーを停止
    if (this.intervalChecker) {
      clearInterval(this.intervalChecker);
      this.intervalChecker = null;
    }
  }

  /**
   * 予約を追加する
   */
  async add(wake: WakeSchedule): Promise<void> {
    const data = await this.loadWakes();
    data.wakes.push(wake);
    await this.saveWakes(data);

    this.scheduleWake(wake);
  }

  /**
   * 予約をキャンセルする
   */
  async cancel(id: string): Promise<boolean> {
    const data = await this.loadWakes();
    const wake = data.wakes.find(w => w.id === id || w.id.startsWith(id));

    if (!wake || wake.status !== 'pending') {
      return false;
    }

    // タイマーをクリア
    const timerId = this.timers.get(wake.id);
    if (timerId) {
      clearTimeout(timerId);
      this.timers.delete(wake.id);
    }

    // ステータスを更新
    wake.status = 'cancelled';
    await this.saveWakes(data);

    return true;
  }

  /**
   * 全ての pending 予約をキャンセル
   */
  async cancelAll(): Promise<number> {
    const data = await this.loadWakes();
    let count = 0;

    for (const wake of data.wakes) {
      if (wake.status === 'pending') {
        const timerId = this.timers.get(wake.id);
        if (timerId) {
          clearTimeout(timerId);
          this.timers.delete(wake.id);
        }
        wake.status = 'cancelled';
        count++;
      }
    }

    await this.saveWakes(data);
    return count;
  }

  /**
   * pending 予約一覧を取得
   */
  async list(): Promise<WakeSchedule[]> {
    const data = await this.loadWakes();
    return data.wakes.filter(w => w.status === 'pending');
  }

  /**
   * 指定時間以内に予約があるか確認
   */
  async hasUpcoming(hoursAhead: number = 12): Promise<boolean> {
    const data = await this.loadWakes();
    const now = new Date();
    const threshold = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    return data.wakes.some(wake => {
      if (wake.status !== 'pending') return false;
      const scheduledAt = new Date(wake.scheduledAt);
      return scheduledAt <= threshold;
    });
  }

  /**
   * 永続化データから予約を復旧
   */
  private async restore(): Promise<void> {
    const data = await this.loadWakes();
    const now = new Date();

    for (const wake of data.wakes) {
      if (wake.status !== 'pending') continue;

      const scheduledAt = new Date(wake.scheduledAt);

      if (scheduledAt <= now) {
        // 過去の予約は即座に発火
        await this.triggerWake(wake);
      } else {
        // 未来の予約はタイマーをセット
        this.scheduleWake(wake);
      }
    }
  }

  /**
   * 予約のタイマーをセットする
   */
  private scheduleWake(wake: WakeSchedule): void {
    const scheduledAt = new Date(wake.scheduledAt);
    const now = new Date();
    const delay = scheduledAt.getTime() - now.getTime();

    if (delay <= 0) {
      // 既に時刻を過ぎている
      this.triggerWake(wake);
      return;
    }

    // setTimeout の上限を超える場合は、後でインターバルチェッカーが処理
    const actualDelay = Math.min(delay, MAX_TIMEOUT);

    const timerId = setTimeout(async () => {
      // 再度時刻を確認（長いタイマーの場合の再スケジュール対応）
      const nowCheck = new Date();
      if (scheduledAt <= nowCheck) {
        await this.triggerWake(wake);
      } else {
        // まだ時間がある場合は再スケジュール
        this.scheduleWake(wake);
      }
    }, actualDelay);

    this.timers.set(wake.id, timerId);
  }

  /**
   * 予約を発火する（claude を起動）
   */
  private async triggerWake(wake: WakeSchedule): Promise<void> {
    // タイマーを削除
    this.timers.delete(wake.id);

    // ステータスを更新
    const data = await this.loadWakes();
    const target = data.wakes.find(w => w.id === wake.id);
    if (target) {
      target.status = 'triggered';
      await this.saveWakes(data);
    }

    // コールバックを呼び出し
    if (this.options.onWakeTriggered) {
      this.options.onWakeTriggered(wake);
    }

    // status.md を更新
    this.statusWriter.update({
      state: 'offline',
      since: nowISO(),
      lastMessageAt: null,
    });

    // プロンプトを構築
    const scheduledDate = new Date(wake.scheduledAt);
    const scheduledJST = `${formatDate(scheduledDate)} ${formatTime(scheduledDate)}`;
    const prompt = `<inhabitant-scheduled-wake id="${wake.id}" scheduled="${scheduledJST}">\n${wake.reason}\n</inhabitant-scheduled-wake>`;

    // セッションIDを取得（--resume で同一セッション）
    const sessionId = this.sessionManager.getSessionId();

    console.log(`Wake ${wake.id} を起動します (scheduled: ${scheduledJST})`);

    const invokeOptions: CliInvokeOptions = {
      prompt,
      sessionId: sessionId ?? undefined,
      skipPermissions: true,
      onChunk: (chunk) => {
        this.debugLog(`wake chunk: ${chunk.slice(0, 100)}`);
      },
      onComplete: (newSessionId, usage) => {
        if (newSessionId) {
          this.sessionManager.updateSessionId(newSessionId);
        }
        this.debugLog(`wake complete: sessionId=${newSessionId}, usage=${JSON.stringify(usage)}`);
      },
      onError: (error) => {
        this.debugLog(`wake error: ${error}`);
        this.options.onError?.(new Error(error));
      },
    };

    process.env.INHABITANT_SESSION_MODE = 'autonomous';
    const handle = this.cliEngine.invoke(invokeOptions);
    handle.on('close', (code) => {
      delete process.env.INHABITANT_SESSION_MODE;
      this.debugLog(`wake process closed: code=${code}`);
    });
  }

  private debugLog(msg: string): void {
    console.log(`[Scheduler] ${msg}`);
  }

  /**
   * 1時間ごとのインターバルチェッカーを開始
   * setTimeout の上限を超える長期予約やシステム時刻変更に対応
   */
  private startIntervalChecker(): void {
    this.intervalChecker = setInterval(async () => {
      try {
        const data = await this.loadWakes();
        const now = new Date();

        for (const wake of data.wakes) {
          if (wake.status !== 'pending') continue;

          const scheduledAt = new Date(wake.scheduledAt);

          if (scheduledAt <= now) {
            // 時刻を過ぎている予約を発火
            await this.triggerWake(wake);
          } else if (!this.timers.has(wake.id)) {
            // タイマーがセットされていない予約をスケジュール
            this.scheduleWake(wake);
          }
        }
      } catch (err) {
        console.error('インターバルチェック中にエラー:', err);
        if (this.options.onError) {
          this.options.onError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }, CHECK_INTERVAL);
  }
}
