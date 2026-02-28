// 統合サーバーでは同一オリジン、環境変数で上書き可能
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export async function fetcher<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// 同一オリジン（空文字）でも動作、環境変数で上書き可能
export const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL ?? "";

// ルーム関連API
export interface RoomDetail {
  id: string;
  name: string;
  claudeMd: string;
  inhabitantMd: string;
  hasProfile: boolean;
}

export async function getRoom(id: string): Promise<RoomDetail> {
  const res = await fetch(`${API_BASE}/api/rooms/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  const data = await res.json();
  return data.room;
}

export async function createRoom(data: {
  id: string;
  name: string;
  claudeMd?: string;
  inhabitantMd?: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${res.status}`);
  }
}

export async function updateRoom(
  id: string,
  data: { name?: string; claudeMd?: string; inhabitantMd?: string }
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/rooms/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${res.status}`);
  }
}

export async function uploadProfileImage(
  id: string,
  file: File
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/rooms/${id}/profile`, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${res.status}`);
  }
}

export async function deleteProfileImage(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/rooms/${id}/profile`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${res.status}`);
  }
}

export function getProfileImageUrl(id: string): string {
  return `${API_BASE}/api/rooms/${id}/profile`;
}

// インハビタント対応 API パス生成
export function inhabitantApiPath(inhabitantId: string, path: string): string {
  return `/api/inhabitants/${inhabitantId}${path}`;
}

// インハビタント対応 fetcher
export function inhabitantFetcher<T>(inhabitantId: string) {
  return (path: string) => fetcher<T>(inhabitantApiPath(inhabitantId, path));
}

export interface InhabitantInfo {
  id: string;
  name: string;
  displayName: string;
  ownerName: string;
  description: string;
}

export interface InhabitantsResponse {
  inhabitants: InhabitantInfo[];
  default: string;
}
