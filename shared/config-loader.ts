/**
 * 0x51DECAFE - Shared Config Loader
 *
 * Loads framework configuration and inhabitant definitions.
 * Usable from both daemon and app via relative import.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";

// ── Inhabitant config (parsed from inhabitant.yaml) ──

export interface ThemeColors {
  primary: string;
  background: string;
  surface: string;
  text: string;
}

export interface InhabitantConfig {
  id: string;
  name: string;
  displayName: string;
  ownerName: string;
  description: string;
  senderId: string;
  theme: { light: ThemeColors; dark: ThemeColors };
  notification: { title: string; tag: string };
  engine?: 'claude-cli' | 'opencode';
}

// ── Inhabitant paths ──

export interface InhabitantPaths {
  root: string;
  daemonData: string;
  appData: string;
  memory: string;
  socket: string;
}

// ── Resolved inhabitant ──

export interface ResolvedInhabitant {
  config: InhabitantConfig;
  paths: InhabitantPaths;
}

// ── Framework config ──

export interface FrameworkConfig {
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

// ── Functions ──

/**
 * Load framework configuration from 0x51decafe.config.ts.
 * @param frameworkRoot - absolute path to framework root; defaults to walking up from shared/.
 */
export async function loadFrameworkConfig(
  frameworkRoot?: string
): Promise<FrameworkConfig> {
  if (!frameworkRoot) {
    const thisDir = dirname(fileURLToPath(import.meta.url));
    frameworkRoot = resolve(thisDir, "..");
  }

  const configPath = join(frameworkRoot, "0x51decafe.config.ts");
  const mod = await import(configPath);
  const raw = mod.default;

  // Resolve inhabitantsDir to absolute path
  const inhabitantsDir = resolve(frameworkRoot, raw.inhabitantsDir ?? raw.charactersDir ?? "./inhabitants");

  return {
    name: raw.name,
    defaultInhabitant: raw.defaultInhabitant ?? raw.defaultCharacter,
    inhabitantsDir,
    paths: {
      claudeCli: raw.paths?.claudeCli ?? "claude",
    },
    app: {
      port: raw.app?.port ?? 3000,
    },
    daemon: {
      socketName: raw.daemon?.socketName ?? "0x51decafe.sock",
      pidFile: raw.daemon?.pidFile ?? "0x51decafe.pid",
      tagPrefix: raw.daemon?.tagPrefix ?? "inhabitant",
    },
    notifications: {
      vapidEmail: raw.notifications?.vapidEmail ?? "",
      lineMessagingApi: raw.notifications?.lineMessagingApi ?? false,
    },
  };
}

/**
 * Scan a directory for subdirs containing inhabitant.yaml and return all resolved inhabitants.
 */
export function discoverInhabitants(inhabitantsDir: string): ResolvedInhabitant[] {
  if (!existsSync(inhabitantsDir)) return [];

  const entries = readdirSync(inhabitantsDir, { withFileTypes: true });
  const inhabitants: ResolvedInhabitant[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = join(inhabitantsDir, entry.name);
    const yamlPath = join(dir, "inhabitant.yaml");
    if (existsSync(yamlPath)) {
      inhabitants.push(loadInhabitant(dir));
    }
  }

  return inhabitants;
}

/**
 * Load a single inhabitant from its directory.
 */
export function loadInhabitant(inhabitantDir: string): ResolvedInhabitant {
  const absDir = resolve(inhabitantDir);
  const yamlPath = join(absDir, "inhabitant.yaml");
  const raw = parseYaml(readFileSync(yamlPath, "utf-8"));

  const config: InhabitantConfig = {
    id: raw.id,
    name: raw.name,
    displayName: raw.displayName ?? raw.name,
    ownerName: raw.ownerName ?? "User",
    description: raw.description ?? "",
    senderId: raw.senderId ?? "inhabitant",
    theme: {
      light: {
        primary: raw.theme?.light?.primary ?? "#6366f1",
        background: raw.theme?.light?.background ?? "#ffffff",
        surface: raw.theme?.light?.surface ?? "#f8f9fa",
        text: raw.theme?.light?.text ?? "#1a1a2e",
      },
      dark: {
        primary: raw.theme?.dark?.primary ?? "#818cf8",
        background: raw.theme?.dark?.background ?? "#1a1a2e",
        surface: raw.theme?.dark?.surface ?? "#16213e",
        text: raw.theme?.dark?.text ?? "#e8e8e8",
      },
    },
    notification: {
      title: raw.notification?.title ?? raw.displayName ?? raw.name,
      tag: raw.notification?.tag ?? "inhabitant-notification",
    },
    engine: raw.engine ?? undefined,
  };

  const paths: InhabitantPaths = {
    root: absDir,
    daemonData: join(absDir, ".daemon"),
    appData: join(absDir, ".data"),
    memory: join(absDir, "memory"),
    socket: join(absDir, ".daemon", "0x51decafe.sock"),
  };

  return { config, paths };
}

/**
 * Resolve an inhabitant directory from various sources:
 * 1. Explicit path (if provided and contains inhabitant.yaml)
 * 2. INHABITANT_HOME env variable
 * 3. defaultInhabitant + inhabitantsDir from framework config
 * 4. Single inhabitant in inhabitantsDir (auto-select)
 */
export function resolveInhabitantDir(
  frameworkConfig: FrameworkConfig,
  inhabitantIdOrDir?: string
): string {
  // 1. Explicit path
  if (inhabitantIdOrDir) {
    const abs = resolve(inhabitantIdOrDir);
    if (existsSync(join(abs, "inhabitant.yaml"))) {
      return abs;
    }
    // Treat as inhabitant ID within inhabitantsDir
    const byId = join(frameworkConfig.inhabitantsDir, inhabitantIdOrDir);
    if (existsSync(join(byId, "inhabitant.yaml"))) {
      return byId;
    }
    throw new Error(`Inhabitant not found: ${inhabitantIdOrDir}`);
  }

  // 2. INHABITANT_HOME env
  const envHome = process.env.INHABITANT_HOME;
  if (envHome) {
    const abs = resolve(envHome);
    if (existsSync(join(abs, "inhabitant.yaml"))) {
      return abs;
    }
  }

  // 3. defaultInhabitant
  const defaultDir = join(
    frameworkConfig.inhabitantsDir,
    frameworkConfig.defaultInhabitant
  );
  if (existsSync(join(defaultDir, "inhabitant.yaml"))) {
    return defaultDir;
  }

  // 4. Single inhabitant auto-select
  const all = discoverInhabitants(frameworkConfig.inhabitantsDir);
  if (all.length === 1) {
    return all[0].paths.root;
  }

  if (all.length === 0) {
    throw new Error(
      `No inhabitants found in ${frameworkConfig.inhabitantsDir}`
    );
  }

  throw new Error(
    `Multiple inhabitants found but no default specified. ` +
      `Available: ${all.map((c) => c.config.id).join(", ")}`
  );
}
