/**
 * 0x51decafe - カスタムサーバー
 * Express + Socket.io + Next.js を単一プロセスで統合
 */
import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "node:http";
import { Server } from "socket.io";
import next from "next";
import { config, getFrameworkConfig } from "./server/config.js";
import { registerTalkHandlers } from "./server/socket/talk-handler.js";
import { loadFrameworkConfig, discoverInhabitants } from "../shared/config-loader.js";
import { createInhabitantContext, type InhabitantContext } from "./server/inhabitant-context.js";
import { initAuthToken, setTokenCookie, requireAuth, verifySocketToken } from "./server/auth.js";

const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

async function main() {
  await nextApp.prepare();

  // ── Load framework config & discover inhabitants ──
  const frameworkConfig = await loadFrameworkConfig();
  const inhabitants = discoverInhabitants(frameworkConfig.inhabitantsDir);

  if (inhabitants.length === 0) {
    console.error(`No inhabitants found in ${frameworkConfig.inhabitantsDir}`);
    process.exit(1);
  }

  // ── Build per-inhabitant contexts ──
  const inhabitantContexts = new Map<string, InhabitantContext>();
  for (const char of inhabitants) {
    inhabitantContexts.set(char.config.id, createInhabitantContext(char));
  }

  const defaultInhabitantId =
    inhabitantContexts.has(frameworkConfig.defaultInhabitant)
      ? frameworkConfig.defaultInhabitant
      : inhabitants[0].config.id;

  function getContext(id: string): InhabitantContext | undefined {
    return inhabitantContexts.get(id);
  }

  function getDefaultContext(): InhabitantContext {
    return inhabitantContexts.get(defaultInhabitantId)!;
  }

  // ── Auth token ──
  const token = initAuthToken();
  console.log(`Auth token: ${token.slice(0, 8)}... (saved to .auth-token)`);

  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // ===== REST API Routes =====
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // ── Auth middleware for all /api/* routes ──
  app.use("/api", requireAuth);

  // ===== Inhabitants API =====
  app.get("/api/inhabitants", (_req, res) => {
    const list = Array.from(inhabitantContexts.values()).map((ctx) => ({
      id: ctx.inhabitant.config.id,
      name: ctx.inhabitant.config.name,
      displayName: ctx.inhabitant.config.displayName,
      ownerName: ctx.inhabitant.config.ownerName,
      description: ctx.inhabitant.config.description,
    }));
    res.json({ inhabitants: list, default: defaultInhabitantId });
  });

  app.get("/api/inhabitants/:id/config", (req, res) => {
    const ctx = getContext(req.params.id);
    if (!ctx) { res.status(404).json({ error: "Inhabitant not found" }); return; }
    res.json(ctx.inhabitant.config);
  });

  // ===== Inhabitant-prefixed API Routes =====

  /**
   * 相対時刻を解析する（例: "1h", "30m", "2d"）
   */
  const parseRelativeTime = (value: string): number | undefined => {
    const asNumber = Number(value);
    if (!isNaN(asNumber)) return asNumber;

    const asDate = new Date(value);
    if (!isNaN(asDate.getTime())) return asDate.getTime();

    const match = value.match(/^(\d+)([mhd])$/);
    if (match) {
      const [, numStr, unit] = match;
      const num = parseInt(numStr, 10);
      const now = Date.now();
      switch (unit) {
        case "m": return now - num * 60 * 1000;
        case "h": return now - num * 60 * 60 * 1000;
        case "d": return now - num * 24 * 60 * 60 * 1000;
      }
    }

    return undefined;
  };

  // ── Chat Messages (prefixed) ──
  app.get("/api/inhabitants/:id/chat/messages", (req, res) => {
    const ctx = getContext(req.params.id);
    if (!ctx) { res.status(404).json({ error: "Inhabitant not found" }); return; }

    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const since = req.query.since ? parseRelativeTime(String(req.query.since)) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;

    const messages = ctx.messageStore.query({ limit, since, search });
    res.json({ messages });
  });

  app.post("/api/inhabitants/:id/chat/messages", async (req, res) => {
    const ctx = getContext(req.params.id);
    if (!ctx) { res.status(404).json({ error: "Inhabitant not found" }); return; }

    const { sender, content } = req.body;
    if (!sender || !content) {
      res.status(400).json({ error: "sender and content are required" });
      return;
    }
    if (sender !== "user" && sender !== "inhabitant") {
      res.status(400).json({ error: "sender must be 'user' or 'inhabitant'" });
      return;
    }

    const message = ctx.messageStore.add(sender, content);

    if (sender === "inhabitant") {
      try {
        const notifyResult = await ctx.notifier.notify(content);
        res.json({ message, notified: notifyResult });
      } catch (err) {
        console.error("Notification error:", err);
        res.json({ message, notified: { method: "none", success: false, error: String(err) } });
      }
    } else {
      res.json({ message });
    }
  });

  // ── Memory (prefixed) ──
  app.get("/api/inhabitants/:id/memory", async (req, res) => {
    const ctx = getContext(req.params.id);
    if (!ctx) { res.status(404).json({ error: "Inhabitant not found" }); return; }

    const files = await ctx.memoryReader.listMemoryFiles();
    res.json({ files });
  });

  app.get("/api/inhabitants/:id/memory/{*path}", async (req, res) => {
    const ctx = getContext(req.params.id);
    if (!ctx) { res.status(404).json({ error: "Inhabitant not found" }); return; }

    const pathArray = req.params.path;
    const filePath = Array.isArray(pathArray) ? pathArray.join("/") : pathArray;
    if (!filePath) {
      res.status(400).json({ error: "File path is required" });
      return;
    }

    const file = await ctx.memoryReader.readMemoryFile(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.json(file);
  });

  // ── Push Notification (prefixed) ──
  app.get("/api/inhabitants/:id/push/vapid-public-key", (req, res) => {
    const ctx = getContext(req.params.id);
    if (!ctx) { res.status(404).json({ error: "Inhabitant not found" }); return; }
    res.json({ publicKey: ctx.vapidManager.getVapidPublicKey() });
  });

  app.post("/api/inhabitants/:id/push/subscribe", (req, res) => {
    const ctx = getContext(req.params.id);
    if (!ctx) { res.status(404).json({ error: "Inhabitant not found" }); return; }

    const { subscription, userAgent } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      res.status(400).json({ error: "Invalid subscription" });
      return;
    }
    const stored = ctx.subscriptionStore.addSubscription(subscription, userAgent);
    res.json({ success: true, id: stored.id });
  });

  app.delete("/api/inhabitants/:id/push/subscribe", (req, res) => {
    const ctx = getContext(req.params.id);
    if (!ctx) { res.status(404).json({ error: "Inhabitant not found" }); return; }

    const { endpoint } = req.body;
    if (!endpoint) {
      res.status(400).json({ error: "endpoint is required" });
      return;
    }
    const removed = ctx.subscriptionStore.removeSubscription(endpoint);
    res.json({ success: removed });
  });

  app.get("/api/inhabitants/:id/push/status", (req, res) => {
    const ctx = getContext(req.params.id);
    if (!ctx) { res.status(404).json({ error: "Inhabitant not found" }); return; }
    res.json({ subscriptions: ctx.subscriptionStore.getSubscriptionCount() });
  });

  // ── Notify (prefixed) ──
  app.post("/api/inhabitants/:id/notify", async (req, res) => {
    const ctx = getContext(req.params.id);
    if (!ctx) { res.status(404).json({ error: "Inhabitant not found" }); return; }

    const { message } = req.body;
    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }
    const result = await ctx.notifier.notify(message);
    res.json(result);
  });

  // ===== Backward-compatible routes (use default inhabitant) =====

  app.get("/api/config", (_req, res) => {
    const ctx = getDefaultContext();
    res.json({
      inhabitantName: ctx.inhabitant.config.displayName,
      ownerName: ctx.inhabitant.config.ownerName,
      appName: frameworkConfig.name || "0x51decafe",
      appDescription: ctx.inhabitant.config.description || "AI Inhabitant Framework",
    });
  });

  app.get("/api/push/vapid-public-key", (_req, res) => {
    const ctx = getDefaultContext();
    res.json({ publicKey: ctx.vapidManager.getVapidPublicKey() });
  });

  app.post("/api/push/subscribe", (req, res) => {
    const ctx = getDefaultContext();
    const { subscription, userAgent } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      res.status(400).json({ error: "Invalid subscription" });
      return;
    }
    const stored = ctx.subscriptionStore.addSubscription(subscription, userAgent);
    res.json({ success: true, id: stored.id });
  });

  app.delete("/api/push/subscribe", (req, res) => {
    const ctx = getDefaultContext();
    const { endpoint } = req.body;
    if (!endpoint) {
      res.status(400).json({ error: "endpoint is required" });
      return;
    }
    const removed = ctx.subscriptionStore.removeSubscription(endpoint);
    res.json({ success: removed });
  });

  app.post("/api/notify", async (req, res) => {
    const ctx = getDefaultContext();
    const { message } = req.body;
    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }
    const result = await ctx.notifier.notify(message);
    res.json(result);
  });

  app.get("/api/push/status", (_req, res) => {
    const ctx = getDefaultContext();
    res.json({ subscriptions: ctx.subscriptionStore.getSubscriptionCount() });
  });

  app.get("/api/memory", async (_req, res) => {
    const ctx = getDefaultContext();
    const files = await ctx.memoryReader.listMemoryFiles();
    res.json({ files });
  });

  app.get("/api/memory/{*path}", async (req, res) => {
    const ctx = getDefaultContext();
    const pathArray = req.params.path;
    const filePath = Array.isArray(pathArray) ? pathArray.join("/") : pathArray;
    if (!filePath) {
      res.status(400).json({ error: "File path is required" });
      return;
    }

    const file = await ctx.memoryReader.readMemoryFile(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.json(file);
  });

  app.get("/api/chat/messages", (req, res) => {
    const ctx = getDefaultContext();
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const since = req.query.since
      ? parseRelativeTime(String(req.query.since))
      : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;

    const messages = ctx.messageStore.query({ limit, since, search });
    res.json({ messages });
  });

  app.post("/api/chat/messages", async (req, res) => {
    const ctx = getDefaultContext();
    const { sender, content } = req.body;

    if (!sender || !content) {
      res.status(400).json({ error: "sender and content are required" });
      return;
    }

    if (sender !== "user" && sender !== "inhabitant") {
      res.status(400).json({ error: "sender must be 'user' or 'inhabitant'" });
      return;
    }

    const message = ctx.messageStore.add(sender, content);

    if (sender === "inhabitant") {
      try {
        const notifyResult = await ctx.notifier.notify(content);
        res.json({ message, notified: notifyResult });
      } catch (err) {
        console.error("Notification error:", err);
        res.json({ message, notified: { method: "none", success: false, error: String(err) } });
      }
    } else {
      res.json({ message });
    }
  });

  // ===== HTTP + Socket.io =====
  const httpServer = createServer(app);
  const io = new Server(httpServer);

  // Socket.IO auth middleware
  io.use((socket, next) => {
    const cookie = socket.handshake.headers.cookie;
    if (verifySocketToken(cookie)) {
      next();
      return;
    }
    // Authorization header fallback (for non-browser clients)
    const authHeader = socket.handshake.headers.authorization;
    if (authHeader?.startsWith("Bearer ") && authHeader.slice(7) === token) {
      next();
      return;
    }
    next(new Error("Unauthorized"));
  });

  // ===== Speak API =====
  app.post("/api/speak", (req, res) => {
    const { content, surface = 0 } = req.body;
    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }
    io.emit("speak:message", { content, surface, timestamp: Date.now() });
    res.json({ ok: true });
  });

  app.post("/api/inhabitants/:id/speak", (req, res) => {
    const ctx = getContext(req.params.id);
    if (!ctx) { res.status(404).json({ error: "Inhabitant not found" }); return; }

    const { content, surface = 0 } = req.body;
    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }
    io.emit("speak:message", { content, surface, timestamp: Date.now() });
    res.json({ ok: true });
  });

  // ===== Ask API =====
  const pendingAsks = new Map<string, { resolve: (choice: string) => void; timer: NodeJS.Timeout }>();

  function handleAsk(req: express.Request, res: express.Response) {
    const { content, choices } = req.body;
    if (!content || !choices || !Array.isArray(choices) || choices.length < 2) {
      res.status(400).json({ error: "content and choices (array, min 2) are required" });
      return;
    }

    const id = `ask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let responded = false;

    const timer = setTimeout(() => {
      if (!responded) {
        responded = true;
        pendingAsks.delete(id);
        res.status(408).json({ error: "timeout" });
      }
    }, 5 * 60 * 1000);

    pendingAsks.set(id, {
      resolve: (choice: string) => {
        if (!responded) {
          responded = true;
          clearTimeout(timer);
          pendingAsks.delete(id);
          res.json({ ok: true, choice });
        }
      },
      timer,
    });

    res.on("close", () => {
      if (!responded) {
        responded = true;
        clearTimeout(timer);
        pendingAsks.delete(id);
      }
    });

    io.emit("ask:question", { id, content, choices, timestamp: Date.now() });
  }

  app.post("/api/ask", (req, res) => {
    handleAsk(req, res);
  });

  app.post("/api/inhabitants/:id/ask", (req, res) => {
    const ctx = getContext(req.params.id);
    if (!ctx) { res.status(404).json({ error: "Inhabitant not found" }); return; }
    handleAsk(req, res);
  });

  io.on("connection", (socket) => {
    socket.on("ask:answer", ({ id, choice }: { id: string; choice: string }) => {
      const pending = pendingAsks.get(id);
      if (pending) {
        pending.resolve(choice);
      }
    });
  });

  // ===== Next.js Handler (全てのその他のリクエスト、必ず最後) =====
  app.all("/{*splat}", setTokenCookie, (req, res) => {
    return handle(req, res);
  });

  registerTalkHandlers(io, inhabitantContexts, defaultInhabitantId);

  const port = frameworkConfig.app.port || config.port;
  httpServer.listen(port, config.host, () => {
    console.log(
      `0x51decafe running on http://${config.host}:${port} (${dev ? "dev" : "production"})`
    );
    console.log(`Inhabitants: ${Array.from(inhabitantContexts.keys()).join(", ")} (default: ${defaultInhabitantId})`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
