/**
 * ユーティリティ関数群
 *
 * 時刻パース・フォーマット・日付検証など。
 */

/**
 * HH:MM 形式の時刻をパース
 */
export function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

/**
 * YYYY-MM-DD 形式の日付を検証
 */
export function isValidDate(dateStr: string): boolean {
  const match = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * ISO8601形式で現在時刻を取得
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * 日付を YYYY-MM-DD (曜日) 形式でフォーマット（ローカルタイムゾーン）
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  return `${year}-${month}-${day} (${dayOfWeek})`;
}

/**
 * 時刻を HH:MM 形式でフォーマット
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
