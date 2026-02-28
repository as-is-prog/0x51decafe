import type { ChildProcessWithoutNullStreams } from 'node:child_process';

export type SessionMode = 'new' | 'continue' | 'resume';

export interface Episode {
  title: string;
  hook: string;
  summary: string;
  entities: string[];
  when: string;
  importance: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
  refs?: string[];
}

export interface State {
  relationships: Record<string, string>;
  currentGoals: string[];
  recentTopics: string[];
  lastUpdated: string;
}

export interface MemvidInstance {
  roomId: string;
  ready: boolean;
  mem: unknown;
}

export interface InhabitantInfo {
  id: string;
  name: string;
  workspace: string;
}

export interface SessionRecord {
  roomId: string;
  sessionId: string;
  mode: SessionMode;
  process: ChildProcessWithoutNullStreams;
  createdAt: number;
}

export interface SendMessageOptions {
  roomId: string;
  message: string;
  onChunk?: (text: string) => void;
  onError?: (err: string) => void;
  onComplete?: (code?: number | null, sessionId?: string) => void;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
}

export interface ChatRecord {
  chatId: string;
  roomId: string;
  claudeSessionId: string; // empty string until取得
  title?: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface ChatIndexItem {
  chatId: string;
  claudeSessionId: string;
  title?: string;
  createdAt: number;
  updatedAt: number;
  lastMessagePreview?: string;
}
