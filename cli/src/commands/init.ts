/**
 * init コマンド — 対話式ウィザードでinhabitantを生成
 */

import {
  existsSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  symlinkSync,
} from "fs";
import { join, resolve, relative } from "path";
import { execSync } from "child_process";
import { stringify as yamlStringify } from "yaml";
import pc from "picocolors";
import { runPrompts } from "../utils/prompts.js";
import {
  getTemplateDir,
  renderTemplate,
  readTemplate,
  type TemplateVars,
} from "../utils/template.js";
import { findFrameworkRoot } from "../utils/framework.js";

export async function runInit(): Promise<void> {
  console.log(pc.bold("\n🏠 0x51decafe - Inhabitant Setup Wizard\n"));

  // 1. フレームワークルート検出
  const frameworkRoot = findFrameworkRoot();
  if (!frameworkRoot) {
    throw new Error(
      "0x51decafe.config.ts が見つかりません。フレームワークのルートディレクトリで実行してください。",
    );
  }

  const inhabitantsDir = join(frameworkRoot, "inhabitants");

  // 2. 対話式プロンプト
  const answers = await runPrompts(inhabitantsDir);

  // 3. テンプレート変数
  const vars: TemplateVars = {
    CHARACTER_NAME: answers.characterName,
    CHARACTER_DESCRIPTION: answers.description,
    OWNER_NAME: answers.ownerName,
    INHABITANT_NAME: answers.characterName,
    INHABITANT_ID: answers.id,
  };

  // 4. テーマ
  const theme = {
    light: {
      primary: answers.primaryLight ?? "#6366f1",
      background: "#ffffff",
      surface: "#f8f9fa",
      text: "#1a1a2e",
    },
    dark: {
      primary: answers.primaryDark ?? "#818cf8",
      background: "#1a1a2e",
      surface: "#16213e",
      text: "#e8e8e8",
    },
  };

  // 5. ディレクトリ構造を作成
  const targetDir = join(inhabitantsDir, answers.id);
  const templateDir = getTemplateDir(frameworkRoot);

  const dirs = [
    targetDir,
    join(targetDir, ".claude", "rules"),
    join(targetDir, ".claude", "output-styles"),
    join(targetDir, "memory"),
    join(targetDir, ".daemon"),
    join(targetDir, ".data"),
  ];

  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }

  // 5.5. 汎用スキルのシンボリックリンクを作成
  const rootSkillsDir = join(frameworkRoot, ".claude", "skills");
  if (existsSync(rootSkillsDir)) {
    const skillsLinkPath = join(targetDir, ".claude", "skills");
    const skillsRelPath = relative(join(targetDir, ".claude"), rootSkillsDir);
    symlinkSync(skillsRelPath, skillsLinkPath);
  }

  // 6. inhabitant.yaml を生成
  const yamlData = {
    id: answers.id,
    name: answers.characterName,
    displayName: answers.displayName || answers.characterName,
    ownerName: answers.ownerName,
    description: answers.description,
    engine: answers.engine,
    senderId: "inhabitant",
    theme,
    notification: {
      title: answers.displayName || answers.characterName,
      tag: "inhabitant-notification",
    },
  };

  writeFileSync(
    join(targetDir, "inhabitant.yaml"),
    yamlStringify(yamlData),
    "utf-8",
  );

  // 7. テンプレートからファイルを生成（プレースホルダー置換あり）
  const outputStyleName =
    answers.engine === "claude-cli" ? `${answers.id}.md` : "persona.md";
  const templatedFiles: [string, string][] = [
    ["CLAUDE.md.template", "CLAUDE.md"],
    [
      join(".claude", "rules", "91-system.md"),
      join(".claude", "rules", "91-system.md"),
    ],
    [
      join(".claude", "output-styles", "persona.md"),
      join(".claude", "output-styles", outputStyleName),
    ],
  ];

  for (const [src, dest] of templatedFiles) {
    const rendered = renderTemplate(join(templateDir, src), vars);
    writeFileSync(join(targetDir, dest), rendered, "utf-8");
  }

  // 8. テンプレートからファイルをコピー（置換なし）
  const copyFiles: [string, string][] = [
    [join("memory", "long-term.md"), join("memory", "long-term.md")],
    [join("memory", "short-term.md"), join("memory", "short-term.md")],
    [".gitignore", ".gitignore"],
  ];

  for (const [src, dest] of copyFiles) {
    copyFileSync(join(templateDir, src), join(targetDir, dest));
  }

  // 9. エンジン固有ファイルの生成
  if (answers.engine === "opencode") {
    const opencodeConfig = {
      instructions: [
        "CLAUDE.md",
        ".claude/rules/*.md",
        ".claude/output-styles/*.md",
      ],
      permission: {
        read: "allow",
        edit: "ask",
        bash: "ask",
        glob: "allow",
        grep: "allow",
      },
    };
    writeFileSync(
      join(targetDir, "opencode.json"),
      JSON.stringify(opencodeConfig, null, 2) + "\n",
      "utf-8",
    );
  } else {
    // claude-cli: .claude/settings.local.json のひな形を生成
    const claudeSettings = {
      permissions: {
        allow: ["Read", "Edit(memory/**)", "Write(memory/**)"],
      },
      outputStyle: answers.id,
    };
    writeFileSync(
      join(targetDir, ".claude", "settings.local.json"),
      JSON.stringify(claudeSettings, null, 2) + "\n",
      "utf-8",
    );
  }

  // 10. git init
  try {
    execSync("git init", { cwd: targetDir, stdio: "ignore" });
  } catch {
    // git init失敗は致命的ではない
    console.log(
      pc.yellow("⚠ git init に失敗しました。手動で実行してください。"),
    );
  }

  // 11. 完了メッセージ
  const engineConfigFile =
    answers.engine === "opencode"
      ? `inhabitants/${answers.id}/opencode.json`
      : `inhabitants/${answers.id}/.claude/settings.local.json`;

  console.log(
    pc.green(`\n✅ Inhabitant "${answers.characterName}" を作成しました！`),
  );
  console.log(`\n📁 ${pc.cyan(targetDir)}\n`);
  console.log(pc.bold("次のステップ:"));
  console.log(
    `  1. ${pc.cyan(`inhabitants/${answers.id}/.claude/output-styles/${outputStyleName}`)} を編集してキャラクターを設定`,
  );
  console.log(`  2. ${pc.cyan(engineConfigFile)} を確認`);
  console.log(
    `  3. ${pc.cyan(`inhabitants/${answers.id}/.claude/rules/91-system.md`)} にユーザーメッセージを記述`,
  );
  console.log(`  4. ${pc.cyan("0x51decafe-daemon")} を起動して対話を開始`);
  console.log();
}
