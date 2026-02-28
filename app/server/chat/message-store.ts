/**
 * チャットメッセージストア
 * 非同期メッセージ交換用
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

export interface ChatMessage {
  id: string;
  sender: "user" | "inhabitant";
  content: string;
  createdAt: number;
}

interface MessageStoreData {
  version: number;
  messages: ChatMessage[];
}

export function createMessageStore(dataDir: string) {
  const STORE_PATH = join(dataDir, "chat-messages.json");
  const LAST_READ_PATH = join(dataDir, "chat-last-read.json");

  const ensureDir = () => {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
  };

  const readStore = (): MessageStoreData => {
    try {
      if (!existsSync(STORE_PATH)) {
        return { version: 1, messages: [] };
      }
      return JSON.parse(readFileSync(STORE_PATH, "utf-8")) as MessageStoreData;
    } catch {
      return { version: 1, messages: [] };
    }
  };

  const writeStore = (data: MessageStoreData): void => {
    ensureDir();
    writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
  };

  return {
    list(): ChatMessage[] {
      return readStore().messages;
    },

    listSince(since: number): ChatMessage[] {
      return readStore().messages.filter((m) => m.createdAt > since);
    },

    add(sender: "user" | "inhabitant", content: string): ChatMessage {
      const store = readStore();
      const now = Date.now();
      const message: ChatMessage = {
        id: randomUUID(),
        sender,
        content,
        createdAt: now,
      };
      store.messages.push(message);
      writeStore(store);

      if (sender === "inhabitant") {
        ensureDir();
        writeFileSync(LAST_READ_PATH, JSON.stringify({ lastReadAt: now }, null, 2));
      }

      return message;
    },

    count(): number {
      return readStore().messages.length;
    },

    latest(n: number): ChatMessage[] {
      const messages = readStore().messages;
      return messages.slice(-n);
    },

    query(options: {
      limit?: number;
      since?: number;
      search?: string;
    }): ChatMessage[] {
      let messages = readStore().messages;

      if (options.since !== undefined) {
        messages = messages.filter((m) => m.createdAt > options.since!);
      }

      if (options.search) {
        const searchLower = options.search.toLowerCase();
        messages = messages.filter((m) =>
          m.content.toLowerCase().includes(searchLower)
        );
      }

      if (options.limit !== undefined && options.limit > 0) {
        messages = messages.slice(-options.limit);
      }

      return messages;
    },
  };
}

export type MessageStore = ReturnType<typeof createMessageStore>;
