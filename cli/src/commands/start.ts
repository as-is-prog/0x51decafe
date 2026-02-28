/**
 * start コマンド — tmux で daemon + app を起動
 */

import { join } from "path";
import pc from "picocolors";
import {
  tmuxAvailable,
  sessionExists,
  createSession,
  addWindow,
  SESSION_NAME,
} from "../utils/tmux.js";
import { findFrameworkRoot } from "../utils/framework.js";
import { loadFrameworkConfig, discoverInhabitants, resolveInhabitantDir } from "../../../shared/config-loader.js";

export async function runStart(inhabitantId?: string): Promise<void> {
  if (!tmuxAvailable()) {
    throw new Error("tmux がインストールされていません。");
  }

  if (sessionExists()) {
    console.log(pc.yellow(`tmux セッション "${SESSION_NAME}" は既に存在します。`));
    console.log(`  確認: tmux attach -t ${SESSION_NAME}`);
    return;
  }

  const frameworkRoot = findFrameworkRoot();
  if (!frameworkRoot) {
    throw new Error("0x51decafe.config.ts が見つかりません。");
  }

  const fwConfig = await loadFrameworkConfig(frameworkRoot);
  const daemonEntry = join(frameworkRoot, "daemon", "src", "index.ts");
  const appDir = join(frameworkRoot, "app");

  // 起動対象のインハビタントを決定
  let inhabitantDirs: { id: string; dir: string }[];
  if (inhabitantId) {
    const dir = resolveInhabitantDir(fwConfig, inhabitantId);
    inhabitantDirs = [{ id: inhabitantId, dir }];
  } else {
    const all = discoverInhabitants(fwConfig.inhabitantsDir);
    if (all.length === 0) {
      throw new Error(`インハビタントが見つかりません: ${fwConfig.inhabitantsDir}`);
    }
    inhabitantDirs = all.map((i) => ({ id: i.config.id, dir: i.paths.root }));
  }

  // .env を読み込むプレフィックス
  const envFile = join(frameworkRoot, ".env");
  const envPrefix = `[ -f ${envFile} ] && set -a && . ${envFile} && set +a;`;

  // 最初の daemon window でセッション作成
  const first = inhabitantDirs[0];
  const firstCmd = `${envPrefix} npx tsx ${daemonEntry} daemon run --inhabitant-dir ${first.dir}`;
  createSession(`daemon:${first.id}`, firstCmd, frameworkRoot);

  // 残りの daemon window
  for (const { id, dir } of inhabitantDirs.slice(1)) {
    const cmd = `${envPrefix} npx tsx ${daemonEntry} daemon run --inhabitant-dir ${dir}`;
    addWindow(`daemon:${id}`, cmd, frameworkRoot);
  }

  // app window (production mode: build then start)
  const appCmd = `${envPrefix} npm run build && npm run start`;
  addWindow("app", appCmd, appDir);

  console.log(pc.green(`✅ 0x51decafe を起動しました`));
  console.log(`  daemon: ${inhabitantDirs.map((i) => i.id).join(", ")}`);
  console.log(`  ${pc.cyan("tmux attach -t " + SESSION_NAME)} でセッションに接続`);
  console.log(`  ${pc.cyan("0x51decafe stop")} で停止`);
}
