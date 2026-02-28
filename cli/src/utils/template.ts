/**
 * テンプレート処理ユーティリティ
 */

import { readFileSync } from "fs";
import { join } from "path";

export interface TemplateVars {
  CHARACTER_NAME: string;
  CHARACTER_DESCRIPTION: string;
  OWNER_NAME: string;
  INHABITANT_NAME: string;
  INHABITANT_ID: string;
}

/**
 * フレームワークルートからテンプレートディレクトリのパスを解決
 */
export function getTemplateDir(frameworkRoot: string): string {
  return join(frameworkRoot, "templates", "inhabitant-init");
}

/**
 * テンプレートファイルを読み込み、プレースホルダーを置換
 */
export function renderTemplate(
  templatePath: string,
  vars: TemplateVars
): string {
  const content = readFileSync(templatePath, "utf-8");
  return replacePlaceholders(content, vars);
}

/**
 * テンプレートファイルをそのまま読み込み（置換なし）
 */
export function readTemplate(templatePath: string): string {
  return readFileSync(templatePath, "utf-8");
}

/**
 * プレースホルダーを置換
 */
function replacePlaceholders(content: string, vars: TemplateVars): string {
  return content
    .replace(/\{\{CHARACTER_NAME\}\}/g, vars.CHARACTER_NAME)
    .replace(/\{\{CHARACTER_DESCRIPTION\}\}/g, vars.CHARACTER_DESCRIPTION)
    .replace(/\{\{OWNER_NAME\}\}/g, vars.OWNER_NAME)
    .replace(/\{\{INHABITANT_NAME\}\}/g, vars.INHABITANT_NAME)
    .replace(/\{\{INHABITANT_ID\}\}/g, vars.INHABITANT_ID);
}
