---
name: read-messages
description: チャット履歴（LINE的なメッセージ履歴）を読む。セッションが切れて文脈を忘れた時、自律起動時に前回の会話を確認したい時、過去のメッセージを検索したい時に。
---

# Read Messages

## 概要

PWA の `/chat` ページでやり取りした履歴を確認する。

## 使い方

```bash
# 最新10件を取得（デフォルト）
./.claude/skills/read-messages/scripts/read.sh

# 最新20件を取得
./.claude/skills/read-messages/scripts/read.sh --limit 20

# 過去1時間のメッセージ
./.claude/skills/read-messages/scripts/read.sh --since 1h

# 過去30分のメッセージ
./.claude/skills/read-messages/scripts/read.sh --since 30m

# 過去1日のメッセージ
./.claude/skills/read-messages/scripts/read.sh --since 1d

# 文字列検索
./.claude/skills/read-messages/scripts/read.sh --search "おはよう"

# 組み合わせ
./.claude/skills/read-messages/scripts/read.sh --limit 50 --search "keyword"
```

## オプション

| オプション | 説明 | 例 |
|-----------|------|-----|
| `--limit N` | 最新N件に絞る（デフォルト: 10） | `--limit 20` |
| `--since TIME` | 指定時刻以降のみ | `--since 1h`, `--since 30m`, `--since 2d` |
| `--search TEXT` | 本文に含まれる文字列で絞る | `--search "おはよう"` |

## 出力フォーマット

```
[01/25 18:05] (user) Hello!
[01/25 18:06] (inhabitant) ……hello.
```

## 注意点

- アプリサーバー（localhost:3000）が起動している必要がある
- `jq` がインストールされている必要がある
