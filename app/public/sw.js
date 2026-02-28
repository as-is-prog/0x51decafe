/**
 * Service Worker for 0x51decafe PWA
 * Push 通知のハンドリング
 */

// インストール時
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");
  self.skipWaiting();
});

// アクティベート時
self.addEventListener("activate", (event) => {
  console.log("[SW] Service worker activated");
  event.waitUntil(clients.claim());
});

// Push 通知受信時
self.addEventListener("push", (event) => {
  console.log("[SW] Push received:", event.data?.text());

  let data = {
    title: "Inhabitant",
    body: "新しいメッセージがあります",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag || "inhabitant-notification",
    timestamp: data.timestamp || Date.now(),
    vibrate: [200, 100, 200],
    requireInteraction: false,
    data: {
      url: "/chat",
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 通知クリック時
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked");
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // 既存のウィンドウがあればフォーカス
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        // なければ新しいウィンドウを開く
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
