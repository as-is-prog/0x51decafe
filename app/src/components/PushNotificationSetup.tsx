"use client";

import { useState, useEffect, useCallback } from "react";

type NotificationState = "loading" | "unsupported" | "denied" | "prompt" | "subscribed" | "unsubscribed";

interface PushNotificationSetupProps {
  inhabitantId?: string;
}

export function PushNotificationSetup({ inhabitantId }: PushNotificationSetupProps) {
  const [state, setState] = useState<NotificationState>("loading");
  const [isProcessing, setIsProcessing] = useState(false);

  // インハビタント対応パス生成
  const pushPath = useCallback((path: string) => {
    if (inhabitantId) {
      return `/api/inhabitants/${inhabitantId}/push${path}`;
    }
    return `/api/push${path}`;
  }, [inhabitantId]);

  // 状態チェック
  const checkState = useCallback(async () => {
    // Service Worker 非対応
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }

    // 通知許可状態を確認
    const permission = Notification.permission;
    if (permission === "denied") {
      setState("denied");
      return;
    }

    // サブスクリプション状態を確認
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "subscribed" : permission === "granted" ? "unsubscribed" : "prompt");
    } catch {
      setState("prompt");
    }
  }, []);

  useEffect(() => {
    checkState();
  }, [checkState]);

  // サブスクライブ
  const subscribe = async () => {
    setIsProcessing(true);
    try {
      // VAPID 公開鍵を取得
      const keyRes = await fetch(pushPath("/vapid-public-key"));
      const { publicKey } = await keyRes.json();

      // Service Worker を取得
      const reg = await navigator.serviceWorker.ready;

      // Push 購読
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      // サーバーに登録
      await fetch(pushPath("/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });

      setState("subscribed");
    } catch (err) {
      console.error("Push subscription failed:", err);
      // 権限が拒否された可能性
      if (Notification.permission === "denied") {
        setState("denied");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // アンサブスクライブ
  const unsubscribe = async () => {
    setIsProcessing(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        // サーバーから削除
        await fetch(pushPath("/subscribe"), {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });

        // ブラウザから削除
        await sub.unsubscribe();
      }

      setState("unsubscribed");
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Base64 → Uint8Array 変換（VAPID キー用）
  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // レンダリング
  if (state === "loading") {
    return null;
  }

  if (state === "unsupported") {
    return (
      <div className="flex items-center gap-2 text-sm opacity-60">
        <BellOffIcon />
        <span>通知非対応</span>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="flex items-center gap-2 text-sm opacity-60">
        <BellOffIcon />
        <span>通知がブロックされています</span>
      </div>
    );
  }

  if (state === "subscribed") {
    return (
      <button
        onClick={unsubscribe}
        disabled={isProcessing}
        className="group relative flex items-center gap-2 overflow-hidden rounded-xl border-2 px-4 py-2 text-sm font-medium shadow-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
        style={{
          borderColor: "var(--color-success)",
          color: "var(--color-success)",
          background: "var(--background-elevated)",
        }}
      >
        <BellIcon />
        <span>{isProcessing ? "処理中..." : "通知ON"}</span>
      </button>
    );
  }

  return (
    <button
      onClick={subscribe}
      disabled={isProcessing}
      className="group relative flex items-center gap-2 overflow-hidden rounded-xl border-2 px-4 py-2 text-sm font-medium shadow-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
      style={{
        borderColor: "var(--color-primary)",
        color: "var(--color-primary)",
        background: "var(--background-elevated)",
      }}
    >
      <BellOffIcon />
      <span>{isProcessing ? "処理中..." : "通知を有効化"}</span>
    </button>
  );
}

function BellIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function BellOffIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
      <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
