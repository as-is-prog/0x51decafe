/**
 * Talk ハンドラ — Socket.io 経由のリアルタイム対話
 *
 * デーモン IPC の subscribe で CLI 出力を購読し、WebSocket に転送する。
 * - ユーザー入力への応答（message 経由）
 * - 沈黙タイマー発火への応答（timer 経由）
 * どちらも同じ WebSocket で配信する。
 */

import type { Server, Socket } from "socket.io";
import type { InhabitantContext } from "../inhabitant-context.js";
import type { SubscribeSource, UsageInfo } from "../daemon/ipc-client.js";

// ----------------------------------------------------------------
// Talk 用 Socket.io イベント名
// ----------------------------------------------------------------

export const TalkEvents = {
  // Client -> Server
  SEND: "talk:send",
  TOUCH: "talk:touch",
  PERMISSION_GET: "permission:get",
  PERMISSION_SET: "permission:set",
  // Server -> Client
  CHUNK: "talk:chunk",
  DONE: "talk:done",
  ERROR: "talk:error",
  PERMISSION_CHANGED: "permission:changed",
  // Timer 関連（source が timer の場合に使用）
  TIMER_CHUNK: "talk:timer:chunk",
  TIMER_DONE: "talk:timer:done",
  TIMER_ERROR: "talk:timer:error",
} as const;

// ----------------------------------------------------------------
// ペイロード型
// ----------------------------------------------------------------

interface TalkSendPayload {
  text: string;
}

interface TalkTouchPayload {
  type: "click" | "move";
  collision: string;
}

// ----------------------------------------------------------------
// ハンドラ登録
// ----------------------------------------------------------------

export const registerTalkHandlers = (
  io: Server,
  contexts: Map<string, InhabitantContext>,
  defaultInhabitantId: string,
) => {
  io.on("connection", (socket: Socket) => {
    const query = socket.handshake.query;
    if (query.page !== "talk") return; // talk ページ以外は無視

    const inhabitantId = (query.inhabitantId as string) || defaultInhabitantId;
    const ctx = contexts.get(inhabitantId);
    if (!ctx) return;

    // インハビタント固有の Room に参加（speak/ask のスコープ用）
    socket.join(`inhabitant:${inhabitantId}`);

    console.log("[talk] connection", socket.id, `inhabitant=${inhabitantId}`);

    // プレゼンス: online
    ctx.ipcClient.sendRequest("presence", { state: "online" }).catch((err) => {
      console.error("[talk] presence online failed:", err);
    });

    // subscribe 接続を維持 — CLI出力を受信してWebSocketに転送
    const subscription = ctx.ipcClient.subscribe({
      onSubscribed: () => {
        console.log("[talk] subscribed to daemon");
      },
      onChunk: (text: string, _source: SubscribeSource) => {
        socket.emit(TalkEvents.CHUNK, { text });
      },
      onDone: (sessionId: string | null, _source: SubscribeSource, usage?: UsageInfo) => {
        socket.emit(TalkEvents.DONE, { sessionId, usage });
      },
      onError: (error: string, _source: SubscribeSource) => {
        socket.emit(TalkEvents.ERROR, { error });
      },
      onDisconnect: () => {
        console.log("[talk] subscription disconnected");
      },
    });

    let currentAbort: (() => void) | null = null;

    // permission:get
    socket.on(TalkEvents.PERMISSION_GET, async () => {
      try {
        const res = await ctx.ipcClient.sendRequest("permission.get");
        if (res.ok && res.result) {
          const result = res.result as { skipPermissions: boolean };
          socket.emit(TalkEvents.PERMISSION_CHANGED, { skipPermissions: result.skipPermissions });
        }
      } catch (err) {
        console.error("[talk] permission.get failed:", err);
      }
    });

    // permission:set
    socket.on(TalkEvents.PERMISSION_SET, async (payload: { skipPermissions: boolean }) => {
      try {
        const res = await ctx.ipcClient.sendRequest("permission.set", { skipPermissions: payload.skipPermissions });
        if (res.ok && res.result) {
          const result = res.result as { skipPermissions: boolean };
          socket.emit(TalkEvents.PERMISSION_CHANGED, { skipPermissions: result.skipPermissions });
        }
      } catch (err) {
        console.error("[talk] permission.set failed:", err);
      }
    });

    // talk:send
    socket.on(TalkEvents.SEND, (payload: TalkSendPayload) => {
      console.log("[talk] send", { text: payload.text.slice(0, 50) });

      const { abort } = ctx.ipcClient.sendMessage(
        payload.text,
        (_text) => { },
        (_sessionId, _usage) => { currentAbort = null; },
        (_error) => { currentAbort = null; }
      );

      currentAbort = abort;
    });

    // talk:touch
    socket.on(TalkEvents.TOUCH, (payload: TalkTouchPayload) => {
      const action = payload.type === "click" ? "つつかれました" : "撫でられました";
      const text = `<inhabitant-touch-event>\n${payload.collision}を${action}\n</inhabitant-touch-event>`;
      console.log("[talk] touch", { type: payload.type, collision: payload.collision });

      ctx.ipcClient.sendMessage(
        text,
        (_text) => { },
        (_sessionId, _usage) => { },
        (_error) => { }
      );
    });

    // 切断時
    socket.on("disconnect", () => {
      console.log("[talk] disconnect", socket.id);

      if (currentAbort) {
        currentAbort();
        currentAbort = null;
      }

      // subscribe ソケットを切断 → daemon 側で subscriber=0 を検知して自動 offline 遷移
      subscription.disconnect();
    });
  });
};
