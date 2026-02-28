import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  resolveInhabitantChatsRoot,
  resolveChatFilePath,
  resolveChatIndexPath
} from '../utils/paths.js';
import { ChatIndexItem, ChatMessage, ChatRecord } from '../types.js';

const ensureDir = (dir: string) => {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
};

const readJson = <T>(file: string, fallback: T): T => {
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
};

const writeJson = (file: string, data: unknown) => {
  const dir = path.dirname(file);
  ensureDir(dir);
  writeFileSync(file, JSON.stringify(data, null, 2));
};

export class ChatStore {
  list(roomId: string): ChatIndexItem[] {
    const indexPath = resolveChatIndexPath(roomId);
    if (!existsSync(indexPath)) return [];
    return readJson<ChatIndexItem[]>(indexPath, []);
  }

  get(roomId: string, chatId: string): ChatRecord | null {
    const chatPath = resolveChatFilePath(roomId, chatId);
    if (!existsSync(chatPath)) return null;
    return readJson<ChatRecord>(chatPath, null as any);
  }

  create(roomId: string, claudeSessionId: string, title?: string): ChatRecord {
    const chatId = randomUUID();
    const now = Date.now();
    const record: ChatRecord = {
      chatId,
      roomId,
      claudeSessionId,
      title,
      createdAt: now,
      updatedAt: now,
      messages: []
    };
    this.save(roomId, record);
    return record;
  }

  appendMessage(roomId: string, chatId: string, message: ChatMessage) {
    const chat = this.get(roomId, chatId);
    if (!chat) throw new Error('chat not found');
    chat.messages.push(message);
    chat.updatedAt = Date.now();
    this.save(roomId, chat);
  }

  updateSessionId(roomId: string, chatId: string, sessionId: string) {
    const chat = this.get(roomId, chatId);
    if (!chat) throw new Error('chat not found');
    if (chat.claudeSessionId === sessionId) return chat;
    chat.claudeSessionId = sessionId;
    this.save(roomId, chat);
    return chat;
  }

  private save(roomId: string, chat: ChatRecord) {
    const chatPath = resolveChatFilePath(roomId, chat.chatId);
    writeJson(chatPath, chat);
    this.upsertIndex(roomId, chat);
  }

  private upsertIndex(roomId: string, chat: ChatRecord) {
    const indexPath = resolveChatIndexPath(roomId);
    const index = this.list(roomId);
    const next: ChatIndexItem = {
      chatId: chat.chatId,
      claudeSessionId: chat.claudeSessionId,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      lastMessagePreview: (chat.messages.length ? chat.messages[chat.messages.length - 1] : undefined)?.content.slice(0, 120)
    };
    const replaced = index.map((i) => (i.chatId === chat.chatId ? next : i));
    const exists = index.some((i) => i.chatId === chat.chatId);
    const merged = exists ? replaced : [...index, next];
    writeJson(indexPath, merged);
  }
}

export const chatStore = new ChatStore();
