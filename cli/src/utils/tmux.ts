/**
 * tmux 操作ユーティリティ
 */

import { execSync, spawnSync } from "child_process";

const SESSION_NAME = "0x51decafe";

export function tmuxAvailable(): boolean {
  try {
    spawnSync("tmux", ["-V"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function sessionExists(): boolean {
  const result = spawnSync("tmux", ["has-session", "-t", SESSION_NAME], {
    stdio: "ignore",
  });
  return result.status === 0;
}

export function createSession(windowName: string, command: string, cwd: string): void {
  execSync(
    `tmux new-session -d -s ${SESSION_NAME} -n ${windowName} -c ${quote(cwd)} ${quote(command)}`,
    { stdio: "ignore" }
  );
}

export function addWindow(windowName: string, command: string, cwd: string): void {
  execSync(
    `tmux new-window -t ${SESSION_NAME} -n ${windowName} -c ${quote(cwd)} ${quote(command)}`,
    { stdio: "ignore" }
  );
}

export function killSession(): boolean {
  if (!sessionExists()) return false;
  execSync(`tmux kill-session -t ${SESSION_NAME}`, { stdio: "ignore" });
  return true;
}

export function listWindows(): string[] {
  if (!sessionExists()) return [];
  try {
    const output = execSync(
      `tmux list-windows -t ${SESSION_NAME} -F "#{window_name}"`,
      { encoding: "utf-8" }
    );
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function quote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

export { SESSION_NAME };
