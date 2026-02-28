/**
 * status コマンド — daemon + app のステータス表示
 */

import pc from "picocolors";
import { sessionExists, listWindows, SESSION_NAME } from "../utils/tmux.js";

export function runStatus(): void {
  if (!sessionExists()) {
    console.log(pc.yellow(`0x51decafe は起動していません。`));
    return;
  }

  const windows = listWindows();
  console.log(pc.green(`0x51decafe is running`) + ` (tmux: ${SESSION_NAME})`);
  console.log();

  for (const name of windows) {
    console.log(`  ${pc.cyan("●")} ${name}`);
  }

  console.log();
  console.log(`  ${pc.dim("tmux attach -t " + SESSION_NAME)} でセッションに接続`);
}
