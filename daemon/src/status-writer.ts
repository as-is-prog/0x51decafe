/**
 * status-writer.ts — status.md 動的生成
 *
 * プレゼンス情報に基づいて status.md を更新し、
 * Claude CLI の append-system-prompt として注入する。
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { PresenceInfo } from './types.js';

interface ChatMessage {
  id: string;
  sender: 'user' | 'inhabitant';
  content: string;
  createdAt: number;
}

interface ChatLastRead {
  lastReadAt: number; // Unix ms
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'] as const;

export class StatusWriter {
  private statusFile: string;
  private chatMessagesFile: string;
  private chatLastReadFile: string;
  private ownerName: string;

  constructor({ statusFile, appDataDir, ownerName }: { statusFile: string; appDataDir: string; ownerName: string }) {
    this.statusFile = statusFile;
    this.chatMessagesFile = join(appDataDir, 'chat-messages.json');
    this.chatLastReadFile = join(appDataDir, 'chat-last-read.json');
    this.ownerName = ownerName;
  }

  /**
   * status.md をプレゼンス情報に基づいて更新する。
   */
  update(presence: PresenceInfo): void {
    const now = new Date();
    const timeStr = this.formatJST(now);
    const presenceLabel = presence.state === 'online' ? 'アプリ起動中' : 'オフライン';
    const silenceStr = this.formatSilence(now, presence.lastMessageAt);

    // 未読チャットメッセージの確認
    const lastReadAt = this.readLastReadAt();
    const unreadMessages = this.getUnreadMessages(lastReadAt);

    const lines = [
      '# 現在のステータス',
      `- 時刻: ${timeStr}`,
      `- ${this.ownerName}の状態: ${presenceLabel}`,
      `- 沈黙時間: ${silenceStr}`,
    ];

    if (unreadMessages.length > 0) {
      lines.push(`- LINE通知（${unreadMessages.length}件）`);
    }

    lines.push('');
    const content = lines.join('\n');

    mkdirSync(dirname(this.statusFile), { recursive: true });
    writeFileSync(this.statusFile, content, 'utf-8');
  }

  /**
   * statusFile のパスを返す。
   */
  getStatusFilePath(): string {
    return this.statusFile;
  }

  private readLastReadAt(): number {
    try {
      if (!existsSync(this.chatLastReadFile)) return 0;
      const data = JSON.parse(readFileSync(this.chatLastReadFile, 'utf-8')) as ChatLastRead;
      return data.lastReadAt ?? 0;
    } catch {
      return 0;
    }
  }

  private getUnreadMessages(since: number): ChatMessage[] {
    try {
      if (!existsSync(this.chatMessagesFile)) return [];
      const data = JSON.parse(readFileSync(this.chatMessagesFile, 'utf-8')) as { messages: ChatMessage[] };
      return (data.messages ?? []).filter((m) => m.sender === 'user' && m.createdAt > since);
    } catch {
      return [];
    }
  }

  /**
   * JST で YYYY-MM-DD HH:MM (曜日) 形式にフォーマットする。
   */
  private formatJST(date: Date): string {
    // JST = UTC+9
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(jst.getUTCDate()).padStart(2, '0');
    const h = String(jst.getUTCHours()).padStart(2, '0');
    const min = String(jst.getUTCMinutes()).padStart(2, '0');
    const dayName = DAY_NAMES[jst.getUTCDay()];

    return `${y}-${m}-${d} ${h}:${min} (${dayName})`;
  }

  /**
   * 最終メッセージからの経過時間を人間可読な文字列にする。
   */
  private formatSilence(now: Date, lastMessageAt: string | null): string {
    if (!lastMessageAt) {
      return 'メッセージなし';
    }

    const last = new Date(lastMessageAt);
    const diffMs = now.getTime() - last.getTime();

    if (diffMs < 0) {
      return '0分';
    }

    const totalMinutes = Math.floor(diffMs / (1000 * 60));

    if (totalMinutes < 1) {
      return '1分未満';
    }

    if (totalMinutes < 60) {
      return `${totalMinutes}分`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours < 24) {
      return minutes > 0 ? `${hours}時間${minutes}分` : `${hours}時間`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours > 0) {
      return `${days}日${remainingHours}時間`;
    }
    return `${days}日`;
  }
}
