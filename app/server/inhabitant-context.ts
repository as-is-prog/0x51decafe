/**
 * Per-inhabitant service container
 * inhabitantごとのストア・クライアントをまとめて生成
 */
import type { ResolvedInhabitant } from '../../shared/config-loader.js';
import { createMessageStore, type MessageStore } from './chat/message-store.js';
import { createSubscriptionStore, type SubscriptionStore } from './push/subscription-store.js';
import { createVapidManager, type VapidManager } from './push/vapid.js';
import { createNotifier, type Notifier } from './push/notifier.js';
import { createMemoryReader, type MemoryReader } from './memory/memory-reader.js';
import { createIpcClient, type IpcClient } from './daemon/ipc-client.js';

export interface InhabitantContext {
  inhabitant: ResolvedInhabitant;
  messageStore: MessageStore;
  subscriptionStore: SubscriptionStore;
  vapidManager: VapidManager;
  notifier: Notifier;
  memoryReader: MemoryReader;
  ipcClient: IpcClient;
}

export interface GlobalPushServices {
  subscriptionStore: SubscriptionStore;
  vapidManager: VapidManager;
}

export function createGlobalPushServices(dataDir: string): GlobalPushServices {
  const subscriptionStore = createSubscriptionStore(dataDir);
  const vapidManager = createVapidManager(dataDir, process.env.VAPID_EMAIL);
  return { subscriptionStore, vapidManager };
}

export function createInhabitantContext(
  inhabitant: ResolvedInhabitant,
  globalPush: GlobalPushServices,
): InhabitantContext {
  const messageStore = createMessageStore(inhabitant.paths.appData);
  const { subscriptionStore, vapidManager } = globalPush;
  const notifier = createNotifier({
    inhabitantName: inhabitant.config.notification.title,
    subscriptionStore,
    vapidManager,
  });
  const memoryReader = createMemoryReader(inhabitant.paths.memory);
  const ipcClient = createIpcClient(inhabitant.paths.socket);

  return {
    inhabitant,
    messageStore,
    subscriptionStore,
    vapidManager,
    notifier,
    memoryReader,
    ipcClient,
  };
}
