/**
 * 0x51DECAFE - AI Inhabitant Framework Configuration
 */

export interface InhabitantFrameworkConfig {
  name: string;
  defaultInhabitant: string;
  inhabitantsDir: string;
  paths: {
    claudeCli: string;
  };
  app: {
    port: number;
  };
  daemon: {
    socketName: string;
    pidFile: string;
    tagPrefix: string;
  };
  notifications: {
    vapidEmail: string;
    lineMessagingApi: boolean;
  };
}

const config: InhabitantFrameworkConfig = {
  name: "0x51decafe",
  defaultInhabitant: process.env.DEFAULT_INHABITANT || "nor",
  inhabitantsDir: "./inhabitants",
  paths: {
    claudeCli: process.env.CLAUDE_PATH || "claude",
  },
  app: {
    port: Number(process.env.PORT) || 3000,
  },
  daemon: {
    socketName: "0x51decafe.sock",
    pidFile: "0x51decafe.pid",
    tagPrefix: "inhabitant",
  },
  notifications: {
    vapidEmail: process.env.VAPID_EMAIL || "mailto:noreply@example.com",
    lineMessagingApi: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
  },
};

export default config;
