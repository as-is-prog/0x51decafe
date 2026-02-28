/**
 * stop コマンド — tmux セッションを終了
 */

import pc from "picocolors";
import { killSession, SESSION_NAME } from "../utils/tmux.js";

export function runStop(): void {
  if (killSession()) {
    console.log(pc.green(`✅ 0x51decafe を停止しました`));
  } else {
    console.log(pc.yellow(`tmux セッション "${SESSION_NAME}" は起動していません。`));
  }
}
