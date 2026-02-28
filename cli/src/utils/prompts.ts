/**
 * 対話式プロンプト定義
 */

import prompts from "prompts";
import { existsSync } from "fs";
import { join } from "path";

export interface InitAnswers {
  id: string;
  characterName: string;
  displayName: string;
  ownerName: string;
  description: string;
  engine: 'claude-cli' | 'opencode';
  useDefaultTheme: boolean;
  primaryLight?: string;
  primaryDark?: string;
}

/**
 * Inhabitant IDのバリデーション
 */
function validateId(value: string, inhabitantsDir: string): string | true {
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(value)) {
    return "英小文字・数字・ハイフンのみ使用可能（先頭・末尾にハイフン不可）";
  }
  if (existsSync(join(inhabitantsDir, value))) {
    return `"${value}" は既に存在します`;
  }
  return true;
}

/**
 * 対話式プロンプトを実行
 */
export async function runPrompts(
  inhabitantsDir: string
): Promise<InitAnswers> {
  const onCancel = () => {
    throw new Error("cancelled");
  };

  const response = await prompts(
    [
      {
        type: "text",
        name: "id",
        message: "Inhabitant ID（英小文字・数字・ハイフン）",
        validate: (value: string) => validateId(value, inhabitantsDir),
      },
      {
        type: "text",
        name: "characterName",
        message: "キャラクター名",
        validate: (value: string) =>
          value.trim() ? true : "名前を入力してください",
      },
      {
        type: "text",
        name: "displayName",
        message: "表示名",
        initial: (_prev: unknown, values: Record<string, string>) =>
          values.characterName,
      },
      {
        type: "text",
        name: "ownerName",
        message: "ユーザー名",
        initial: "User",
      },
      {
        type: "text",
        name: "description",
        message: "説明文",
        validate: (value: string) =>
          value.trim() ? true : "説明を入力してください",
      },
      {
        type: "select",
        name: "engine",
        message: "AIエンジンを選択してください",
        choices: [
          { title: "Claude Code CLI", value: "claude-cli" },
          { title: "OpenCode", value: "opencode" },
        ],
        initial: 0,
      },
      {
        type: "confirm",
        name: "useDefaultTheme",
        message: "デフォルトテーマカラーを使用しますか？",
        initial: true,
      },
      {
        type: (prev: boolean) => (prev ? null : "text"),
        name: "primaryLight",
        message: "ライトテーマのプライマリカラー（hex）",
        initial: "#6366f1",
        validate: (value: string) =>
          /^#[0-9a-fA-F]{6}$/.test(value)
            ? true
            : "有効なhexカラーを入力してください（例: #6366f1）",
      },
      {
        type: (_prev: unknown, values: Record<string, unknown>) =>
          values.useDefaultTheme ? null : "text",
        name: "primaryDark",
        message: "ダークテーマのプライマリカラー（hex）",
        initial: "#818cf8",
        validate: (value: string) =>
          /^#[0-9a-fA-F]{6}$/.test(value)
            ? true
            : "有効なhexカラーを入力してください（例: #818cf8）",
      },
    ],
    { onCancel }
  );

  return response as InitAnswers;
}
