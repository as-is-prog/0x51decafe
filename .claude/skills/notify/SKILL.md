---
name: notify
description: ユーザーにメッセージを送信する（LINE的なメッセージ送信）。何か伝えたい時に。オフライン時はこちらを使う。
---

# Notify

## 概要

ユーザーにメッセージを送信する。PWA の `/chat` ページにメッセージが届き、Push 通知で知らせる。

## いつ使うか

- ユーザーに何か伝えたい時
- 自律駆動中で、CLI が使えない時

## 使い方

```bash
./.claude/skills/notify/scripts/send.sh "メッセージ"
```

## 注意点

- アプリサーバー（localhost:3000）が起動している必要がある

## 詳細

内部実装は [references/spec.md](./references/spec.md) を参照。
