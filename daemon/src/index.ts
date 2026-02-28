#!/usr/bin/env node
/**
 * 0x51decafe-daemon CLI エントリポイント
 *
 * Usage:
 *   npx tsx src/index.ts daemon run     — フォアグラウンド起動
 *   npx tsx src/index.ts daemon start   — バックグラウンド起動
 *   npx tsx src/index.ts daemon stop    — 停止
 *   npx tsx src/index.ts daemon status  — ステータス表示
 *
 * デフォルト（引数なし）は `daemon run` と同じ。
 * バックグラウンド起動時に `npx tsx index.ts daemon run` と呼ばれるため。
 */

import { resolve } from 'path';
import { Command } from 'commander';
import { runDaemon, startDaemon, stopDaemon, reloadDaemon, getDaemonStatus } from './daemon.js';
import { resolveDaemonPaths } from './types.js';
import { loadFrameworkConfig, resolveInhabitantDir } from '../../shared/config-loader.js';

async function resolveDir(explicitDir?: string): Promise<string> {
  if (explicitDir) return resolve(explicitDir);
  const fwConfig = await loadFrameworkConfig();
  return resolveInhabitantDir(fwConfig);
}

const program = new Command();

program
  .name('0x51decafe-daemon')
  .description('AI Inhabitant daemon - CLI invocation and session management')
  .version('1.0.0');

// ---- daemon コマンドグループ ----
const daemon = program
  .command('daemon')
  .description('デーモン管理')
  .option('--inhabitant-dir <path>', 'inhabitantディレクトリのパス');

// daemon run — フォアグラウンド起動
daemon
  .command('run')
  .description('フォアグラウンドで起動')
  .action(async () => {
    const inhabitantDir = await resolveDir(daemon.opts().inhabitantDir);
    await runDaemon(inhabitantDir);
  });

// daemon start — バックグラウンド起動
daemon
  .command('start')
  .description('バックグラウンドで起動')
  .action(async () => {
    try {
      const inhabitantDir = await resolveDir(daemon.opts().inhabitantDir);
      const { pid } = await startDaemon(inhabitantDir);
      console.log(`0x51decafe-daemon started (PID: ${pid})`);
    } catch (err) {
      console.error(`Failed to start: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

// daemon stop — 停止
daemon
  .command('stop')
  .description('デーモンを停止')
  .action(async () => {
    const inhabitantDir = await resolveDir(daemon.opts().inhabitantDir);
    const paths = resolveDaemonPaths(inhabitantDir);
    const stopped = await stopDaemon(paths);
    if (stopped) {
      console.log('0x51decafe-daemon stopped.');
    } else {
      console.log('0x51decafe-daemon is not running.');
    }
  });

// daemon reload — リロード（コード再読込、セッション維持）
daemon
  .command('reload')
  .description('デーモンをリロード（コード再読込、セッション維持）')
  .action(async () => {
    const inhabitantDir = await resolveDir(daemon.opts().inhabitantDir);
    const paths = resolveDaemonPaths(inhabitantDir);
    const reloaded = await reloadDaemon(paths);
    if (reloaded) {
      console.log('0x51decafe-daemon reload requested.');
    } else {
      console.log('0x51decafe-daemon is not running.');
    }
  });

// daemon status — ステータス表示
daemon
  .command('status')
  .description('ステータスを表示')
  .action(async () => {
    const inhabitantDir = await resolveDir(daemon.opts().inhabitantDir);
    const paths = resolveDaemonPaths(inhabitantDir);
    const status = await getDaemonStatus(paths);
    if (!status) {
      console.log('0x51decafe-daemon is not running.');
      return;
    }

    const uptimeSec = Math.floor(status.uptime / 1000);
    const uptimeMin = Math.floor(uptimeSec / 60);
    const uptimeHour = Math.floor(uptimeMin / 60);

    let uptimeStr: string;
    if (uptimeHour > 0) {
      uptimeStr = `${uptimeHour}h ${uptimeMin % 60}m`;
    } else if (uptimeMin > 0) {
      uptimeStr = `${uptimeMin}m ${uptimeSec % 60}s`;
    } else {
      uptimeStr = `${uptimeSec}s`;
    }

    console.log(`Status:     running`);
    console.log(`PID:        ${status.pid ?? 'unknown'}`);
    console.log(`Socket:     ${status.socketPath}`);
    console.log(`Uptime:     ${uptimeStr}`);
    console.log(`Session:    ${status.sessionId ?? '(none)'}`);
    console.log(`Presence:   ${status.presence.state} (since ${status.presence.since})`);
  });

// ---- デフォルト: 引数なしは `daemon run` ----
if (process.argv.length <= 2) {
  (async () => {
    try {
      const inhabitantDir = await resolveDir();
      await runDaemon(inhabitantDir);
    } catch (err) {
      console.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  })();
} else {
  program.parse(process.argv);
}
