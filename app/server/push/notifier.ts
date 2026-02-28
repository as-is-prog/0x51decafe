/**
 * 通知送信ロジック
 * PWA Push を優先し、失敗時は LINE Notify にフォールバック
 */
import webPush from "web-push";
import { readFileSync, existsSync } from "node:fs";
import type { SubscriptionStore } from "./subscription-store.js";
import type { VapidManager } from "./vapid.js";

interface LineConfig {
  channelAccessToken: string;
  userId: string;
}

export interface NotifyResult {
  method: "push" | "line" | "none";
  success: boolean;
  delivered?: number;
  failed?: number;
  error?: string;
}

export function createNotifier(opts: {
  inhabitantName: string;
  subscriptionStore: SubscriptionStore;
  vapidManager: VapidManager;
  lineEnvPath?: string;
}) {
  const { inhabitantName, subscriptionStore, vapidManager, lineEnvPath } = opts;

  function loadLineConfig(): LineConfig | null {
    if (!lineEnvPath || !existsSync(lineEnvPath)) {
      return null;
    }

    try {
      const content = readFileSync(lineEnvPath, "utf-8");
      const lines = content.split("\n");
      const env: Record<string, string> = {};

      for (const line of lines) {
        const match = line.match(/^(\w+)=(.*)$/);
        if (match) {
          env[match[1]] = match[2];
        }
      }

      if (!env.MESSAGING_API_CHANNEL_ACCESS_TOKEN || !env.MESSAGING_API_USER_ID) {
        return null;
      }

      return {
        channelAccessToken: env.MESSAGING_API_CHANNEL_ACCESS_TOKEN,
        userId: env.MESSAGING_API_USER_ID,
      };
    } catch {
      return null;
    }
  }

  async function sendLineNotify(message: string): Promise<{ success: boolean; error?: string }> {
    const config = loadLineConfig();
    if (!config) {
      return { success: false, error: "LINE config not available" };
    }

    try {
      const response = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.channelAccessToken}`,
        },
        body: JSON.stringify({
          to: config.userId,
          messages: [{ type: "text", text: message }],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `LINE API error: ${response.status} ${text}` };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: `LINE send failed: ${err}` };
    }
  }

  async function sendPushNotifications(
    message: string
  ): Promise<{ delivered: number; failed: number }> {
    vapidManager.configureWebPush();

    const subscriptions = subscriptionStore.getAllSubscriptions();
    let delivered = 0;
    let failed = 0;

    const payload = JSON.stringify({
      title: inhabitantName,
      body: message,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "inhabitant-notification",
      timestamp: Date.now(),
    });

    for (const sub of subscriptions) {
      try {
        await webPush.sendNotification(subscriptionStore.toPushSubscription(sub), payload);
        delivered++;
      } catch (err: unknown) {
        console.error(`Push failed for ${sub.endpoint}:`, err);
        failed++;

        if (
          typeof err === "object" &&
          err !== null &&
          "statusCode" in err &&
          (err.statusCode === 410 || err.statusCode === 404)
        ) {
          console.log(`Removing expired subscription: ${sub.id}`);
          subscriptionStore.removeSubscription(sub.endpoint);
        }
      }
    }

    return { delivered, failed };
  }

  return {
    async notify(message: string): Promise<NotifyResult> {
      const subscriptions = subscriptionStore.getAllSubscriptions();

      if (subscriptions.length > 0) {
        try {
          const pushResult = await sendPushNotifications(message);

          if (pushResult.delivered > 0) {
            return {
              method: "push",
              success: true,
              delivered: pushResult.delivered,
              failed: pushResult.failed,
            };
          }
        } catch (err) {
          console.error("Push notification error:", err);
        }
      }

      const lineResult = await sendLineNotify(message);

      if (lineResult.success) {
        return {
          method: "line",
          success: true,
        };
      }

      return {
        method: "none",
        success: false,
        error: lineResult.error || "All notification methods failed",
      };
    },
  };
}

export type Notifier = ReturnType<typeof createNotifier>;
