import { loadFrameworkConfig, type FrameworkConfig } from '../../shared/config-loader.js';

let _frameworkConfig: FrameworkConfig | null = null;

export async function getFrameworkConfig(): Promise<FrameworkConfig> {
  if (!_frameworkConfig) {
    _frameworkConfig = await loadFrameworkConfig();
  }
  return _frameworkConfig;
}

export const config = {
  host: process.env.HOST ?? "0.0.0.0",
  port: Number(process.env.PORT ?? 3000),
  claudeCommand: process.env.CLAUDE_CMD ?? "claude",
};

export type AppConfig = typeof config;
