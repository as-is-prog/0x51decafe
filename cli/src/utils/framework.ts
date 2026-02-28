/**
 * フレームワークルート検出
 */

import { existsSync } from "fs";
import { join, resolve } from "path";

export function findFrameworkRoot(): string | null {
  let dir = process.cwd();
  while (true) {
    if (existsSync(join(dir, "0x51decafe.config.ts"))) {
      return dir;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) return null;
    dir = parent;
  }
}
