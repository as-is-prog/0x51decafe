/**
 * Push サブスクリプション管理
 * ブラウザからの登録情報を永続化
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { PushSubscription } from "web-push";

interface StoredSubscription {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt: string;
  userAgent?: string;
}

interface SubscriptionData {
  version: number;
  subscriptions: StoredSubscription[];
}

export function createSubscriptionStore(dataDir: string) {
  const SUBSCRIPTIONS_PATH = join(dataDir, "push-subscriptions.json");

  function ensureDir(): void {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
  }

  function loadData(): SubscriptionData {
    ensureDir();
    if (!existsSync(SUBSCRIPTIONS_PATH)) {
      return { version: 1, subscriptions: [] };
    }
    try {
      const content = readFileSync(SUBSCRIPTIONS_PATH, "utf-8");
      return JSON.parse(content) as SubscriptionData;
    } catch {
      return { version: 1, subscriptions: [] };
    }
  }

  function saveData(data: SubscriptionData): void {
    ensureDir();
    writeFileSync(SUBSCRIPTIONS_PATH, JSON.stringify(data, null, 2));
  }

  return {
    addSubscription(
      subscription: PushSubscription,
      userAgent?: string
    ): StoredSubscription {
      const data = loadData();
      const existingIndex = data.subscriptions.findIndex(
        (s) => s.endpoint === subscription.endpoint
      );

      const stored: StoredSubscription = {
        id: existingIndex >= 0 ? data.subscriptions[existingIndex].id : randomUUID(),
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        createdAt:
          existingIndex >= 0
            ? data.subscriptions[existingIndex].createdAt
            : new Date().toISOString(),
        userAgent,
      };

      if (existingIndex >= 0) {
        data.subscriptions[existingIndex] = stored;
      } else {
        data.subscriptions.push(stored);
      }

      saveData(data);
      return stored;
    },

    removeSubscription(endpoint: string): boolean {
      const data = loadData();
      const initialLength = data.subscriptions.length;
      data.subscriptions = data.subscriptions.filter((s) => s.endpoint !== endpoint);

      if (data.subscriptions.length < initialLength) {
        saveData(data);
        return true;
      }
      return false;
    },

    getAllSubscriptions(): StoredSubscription[] {
      return loadData().subscriptions;
    },

    getSubscriptionCount(): number {
      return loadData().subscriptions.length;
    },

    toPushSubscription(stored: StoredSubscription): PushSubscription {
      return {
        endpoint: stored.endpoint,
        keys: stored.keys,
      };
    },
  };
}

export type SubscriptionStore = ReturnType<typeof createSubscriptionStore>;
