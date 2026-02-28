/**
 * VAPID キー管理
 * Web Push の認証に使用するキーを管理
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import webPush from "web-push";

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

export function createVapidManager(dataDir: string, vapidEmail?: string) {
  const email = vapidEmail || process.env.VAPID_EMAIL || "mailto:noreply@example.com";
  const KEYS_PATH = join(dataDir, "push-keys.json");
  let cachedKeys: VapidKeys | null = null;

  return {
    getVapidKeys(): VapidKeys {
      if (cachedKeys) {
        return cachedKeys;
      }

      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }

      if (existsSync(KEYS_PATH)) {
        try {
          const content = readFileSync(KEYS_PATH, "utf-8");
          cachedKeys = JSON.parse(content) as VapidKeys;
          return cachedKeys;
        } catch {
          console.warn("Failed to read VAPID keys, generating new ones...");
        }
      }

      const keys = webPush.generateVAPIDKeys();
      cachedKeys = {
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
      };

      writeFileSync(KEYS_PATH, JSON.stringify(cachedKeys, null, 2));
      console.log("Generated new VAPID keys");

      return cachedKeys;
    },

    getVapidPublicKey(): string {
      return this.getVapidKeys().publicKey;
    },

    configureWebPush(): void {
      const keys = this.getVapidKeys();
      webPush.setVapidDetails(email, keys.publicKey, keys.privateKey);
    },
  };
}

export type VapidManager = ReturnType<typeof createVapidManager>;
