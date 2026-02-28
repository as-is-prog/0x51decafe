#!/usr/bin/env node
/**
 * 0x51decafe CLI エントリポイント
 *
 * Usage:
 *   npx 0x51decafe init                    — 対話式ウィザードでinhabitantを生成
 *   npx 0x51decafe start [--inhabitant id] — daemon + app を起動
 *   npx 0x51decafe stop                    — 停止
 *   npx 0x51decafe status                  — ステータス表示
 */

import { Command } from "commander";
import { runInit } from "./commands/init.js";
import { runStart } from "./commands/start.js";
import { runStop } from "./commands/stop.js";
import { runStatus } from "./commands/status.js";

const program = new Command();

program
  .name("0x51decafe")
  .description("0x51decafe - AI Inhabitant Framework CLI")
  .version("1.0.0");

program
  .command("init")
  .description("対話式ウィザードで新しいinhabitantを作成")
  .action(async () => {
    try {
      await runInit();
    } catch (err) {
      if (err instanceof Error && err.message === "cancelled") {
        console.log("\nキャンセルされました。");
        process.exit(0);
      }
      console.error(
        `エラー: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exit(1);
    }
  });

program
  .command("start")
  .description("daemon + app を tmux で起動")
  .option("--inhabitant <id>", "起動するinhabitantのID")
  .action(async (opts) => {
    try {
      await runStart(opts.inhabitant);
    } catch (err) {
      console.error(
        `エラー: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exit(1);
    }
  });

program
  .command("stop")
  .description("daemon + app を停止")
  .action(() => {
    runStop();
  });

program
  .command("status")
  .description("ステータスを表示")
  .action(() => {
    runStatus();
  });

program.parse(process.argv);
