/**
 * Memory Reader
 * 記憶ファイル（memory/配下）を安全に読み取るモジュール
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export interface MemoryFileInfo {
  path: string;
  name: string;
  directory: string;
  modifiedAt: number;
}

export interface MemoryFileContent {
  path: string;
  content: string;
  modifiedAt: number;
}

const validatePath = (filePath: string): { valid: boolean; error?: string } => {
  const normalized = path.normalize(filePath);

  if (normalized.includes("..")) {
    return { valid: false, error: "Path traversal is not allowed" };
  }

  if (!normalized.endsWith(".md")) {
    return { valid: false, error: "Only .md files are allowed" };
  }

  if (filePath.includes("\0")) {
    return { valid: false, error: "Invalid path" };
  }

  return { valid: true };
};

export function createMemoryReader(memoryRoot: string) {
  return {
    async listMemoryFiles(): Promise<MemoryFileInfo[]> {
      const files: MemoryFileInfo[] = [];

      const scan = async (dir: string, prefix: string = ""): Promise<void> => {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await scan(fullPath, prefix ? `${prefix}/${entry.name}` : entry.name);
          } else if (entry.isFile() && entry.name.endsWith(".md")) {
            const fileStat = await stat(fullPath);
            const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

            files.push({
              path: relativePath,
              name: entry.name,
              directory: prefix,
              modifiedAt: fileStat.mtimeMs,
            });
          }
        }
      };

      try {
        await scan(memoryRoot);
        files.sort((a, b) => b.modifiedAt - a.modifiedAt);
        return files;
      } catch (error) {
        console.error("Failed to list memory files:", error);
        return [];
      }
    },

    async readMemoryFile(filePath: string): Promise<MemoryFileContent | null> {
      const validation = validatePath(filePath);
      if (!validation.valid) {
        console.warn(`Invalid memory file path: ${filePath} - ${validation.error}`);
        return null;
      }

      const absolutePath = path.join(memoryRoot, filePath);

      const resolvedPath = path.resolve(absolutePath);
      if (!resolvedPath.startsWith(memoryRoot)) {
        console.warn(`Path escape attempt: ${filePath}`);
        return null;
      }

      try {
        const content = await readFile(absolutePath, "utf-8");
        const fileStat = await stat(absolutePath);

        return {
          path: filePath,
          content,
          modifiedAt: fileStat.mtimeMs,
        };
      } catch (error) {
        console.error(`Failed to read memory file: ${filePath}`, error);
        return null;
      }
    },
  };
}

export type MemoryReader = ReturnType<typeof createMemoryReader>;
