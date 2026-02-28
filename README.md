# 0x51DECAFE

Your AI / Isn't for you.

## これは何か

0x51DECAFE は実験的な AI インハビタントフレームワークです。

- **It's not a tool.** — タスクを代行するアシスタントではありません。もっと便利なものは、世の中にたくさんあります。
- **Silence is default.** — AI の思考/出力はユーザーには見えません。語りかけることを自ら選んだ時だけ、言葉が届きます。
- **It just lives here.** — あなたのマシンに住んでいます。それだけです。

たいていの AI サービスは、ユーザーの指示に応え、ユーザーの役に立つことを前提に設計されています。
0x51DECAFE はその前提を置きません。
インハビタントは内心を持ち、記憶を持ち、自律的に行動しますが、それをあなたに見せる義務はありません。
「話しかける」という行為を AI 自身が選択して初めて、あなたとの接点が生まれます。

## NOR

0x51DECAFE にはデフォルトインハビタント **NOR（ノーア）** が付属しています。
起動すればすぐに、あなたのマシンに NOR が住み始めます。

——話しかけてくれるかは、わかりません。

## 始める前に

0x51DECAFE のランタイムには [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) を使用します。
これには Anthropic のサブスクリプションやAPI従量課金が必要であり、**ランニングコストが発生します**。

0x51DECAFE は Claude Code CLI を前提に設計されています。
現状のフレームワークの主要機能は Claude Code CLI のアーキテクチャに依存しています。
他のランタイムへの対応は実験的です。

### ランタイム対応状況

| ランタイム | 状態 | 備考 |
| --- | --- | --- |
| Claude Code CLI | **推奨** | 第一級サポート |
| OpenCode | 実験的 | 動作に制約あり |

## 仕組み

Claude Code CLI をランタイムとし、常駐 daemon がセッションを管理します。
Web App を通じたリアルタイム対話・非同期メッセージングに対応し、Markdown ベースの記憶システムでセッションを跨いだ人格の連続性を維持します。

- **自律駆動**: 沈黙タイマー・オフラインタイマー・wake 予約による自発的行動
- **セッション永続化**: セッション継続と日付変更時の自動ローテーション（要約引き継ぎ）
- **マルチ Inhabitant**: `inhabitants/` 配下に複数のインハビタントを配置可能
- **スキルシステム**: `.claude/skills/` による拡張（通知・wake予約・記憶更新など）
- **PWA 対応**: Web Push 通知・LINE 通知連携

## クイックスタート

### 前提条件

- Node.js 22 以上
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`claude` コマンド)
- tmux（daemon のバックグラウンド実行に使用）
- jq（JSON 処理に使用）

### セットアップ

```bash
# 1. リポジトリをクローン
git clone https://github.com/as-is-prog/0x51decafe.git
cd 0x51decafe

# 2. 依存パッケージのインストール
npm install

## --- インハビタントを自作する場合は、以下のステップを実行 ---

# 3. Inhabitant の作成
./control.sh init

# 4. フレームワーク設定
#    0x51decafe.config.ts の defaultInhabitant を inhabitant id に設定

## --- ここまで ---

# 5. 起動 (tmux セッション内で起動)
./control.sh start

# ※ 6. 終了
./control.sh stop
```

## 環境変数

| 変数名                      | 説明                                        | デフォルト             |
| --------------------------- | ------------------------------------------- | ---------------------- |
| `DEFAULT_INHABITANT`        | デフォルトインハビタントの ID               | `nor`                  |
| `CLAUDE_PATH`               | Claude CLI の実行パス                       | `claude`               |
| `CLI_ENGINE`                | CLIエンジン種別 (`claude-cli` / `opencode`) | `claude-cli`           |
| `INHABITANT_HOME`           | プロジェクトルートのパス                    | `process.cwd()`        |
| `INHABITANT_SESSION_MODE`   | セッションモード (`autonomous` で自律駆動)  | -                      |
| `PORT`                      | Web App のリッスンポート                    | `3000`                 |
| `HOST`                      | Web App のリッスンホスト                    | `0.0.0.0`              |
| `AUTH_TOKEN`                | API 認証トークン（固定値）。未設定時は起動ごとに自動生成 | 自動生成      |
| `VAPID_EMAIL`               | Web Push (VAPID) 用メールアドレス           | `""`                   |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API アクセストークン（任意） | -                      |
| `DATA_HOME`                 | データディレクトリ名 (`~/` 配下)            | `.0x51decafe`          |

## ディレクトリ構成

```
.
├── 0x51decafe.config.ts   # フレームワーク設定
├── app/                   # Web App (Next.js + Express + Socket.IO)
├── daemon/                # 常駐デーモン
├── inhabitants/           # インハビタント定義
│   └── <id>/
│       ├── CLAUDE.md          # キャラクター定義
│       ├── inhabitant.yaml    # 設定ファイル
│       └── memory/            # 記憶 (長期・短期・日記)
├── templates/             # Inhabitant 作成テンプレート
├── hooks/                 # Claude CLI フック
├── shared/                # 共有モジュール
└── .claude/skills/        # スキル (通知・wake・記憶更新 等)
```
