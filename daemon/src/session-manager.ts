/**
 * session-manager.ts — セッション管理
 *
 * session.json を通じて Claude CLI のセッションIDを永続化する。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SessionData } from './types.js';

/**
 * 現在の JST Date オブジェクトを返す。
 */
function getJstNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

/**
 * 現在のJST日付を YYYY-MM-DD 形式で返す。
 */
function getJstDateString(): string {
  return getJstNow().toISOString().slice(0, 10);
}

export class SessionManager {
  private sessionFile: string;

  constructor(sessionFile: string) {
    this.sessionFile = sessionFile;
  }
  /**
   * session.json の内容を読み取る。
   * ファイルが存在しない、またはパースに失敗した場合は null を返す。
   */
  private readData(): SessionData | null {
    try {
      const raw = readFileSync(this.sessionFile, 'utf-8');
      return JSON.parse(raw) as SessionData;
    } catch {
      return null;
    }
  }

  /**
   * session.json に書き込む。既存の lastRotationDate を保持する。
   */
  private writeData(patch: Partial<SessionData>): void {
    const existing = this.readData();
    const data: SessionData = {
      sessionId: patch.sessionId ?? existing?.sessionId ?? null,
      updatedAt: new Date().toISOString(),
      lastRotationDate: patch.lastRotationDate ?? existing?.lastRotationDate,
    };

    mkdirSync(dirname(this.sessionFile), { recursive: true });
    writeFileSync(this.sessionFile, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  }

  /**
   * session.json からセッションIDを読み取る。
   * ファイルが存在しない、またはパースに失敗した場合は null を返す。
   */
  getSessionId(): string | null {
    const data = this.readData();
    return data?.sessionId ?? null;
  }

  /**
   * session.json にセッションIDを保存する。
   */
  updateSessionId(id: string): void {
    this.writeData({ sessionId: id });
  }

  /**
   * session.json をクリアする（セッションIDを null に設定）。
   */
  clearSession(): void {
    this.writeData({ sessionId: null });
  }

  /**
   * セッションローテーションが必要か判定する。
   * - セッションIDが null（まだセッションがない）場合は false
   * - JST 02:00〜04:00 の時間帯でなければ false
   * - 現在のJST日付が lastRotationDate と同じなら false（同日中は再実行しない）
   */
  shouldRotate(): boolean {
    const data = this.readData();
    if (!data?.sessionId) return false;

    // JST 02:00〜04:00 の間のみ実行
    const jstHour = getJstNow().getUTCHours();
    if (jstHour < 2 || jstHour >= 4) return false;

    const todayJst = getJstDateString();

    // 同日中は再実行しない
    if (data.lastRotationDate === todayJst) return false;

    return true;
  }

  /**
   * ローテーション日付を今日のJST日付で記録する。
   */
  markRotated(): void {
    this.writeData({ lastRotationDate: getJstDateString() });
  }
}
