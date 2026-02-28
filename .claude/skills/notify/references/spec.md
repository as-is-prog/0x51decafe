# Notify 内部仕様

## アーキテクチャ

```
インハビタント (Claude CLI)
  │
  ├─ send.sh "メッセージ"
  │
  └──▶ POST /api/chat/messages
       │  body: { sender: "inhabitant", content: "メッセージ" }
       │
       └──▶ 1. チャット履歴に保存
            2. PWA Push 通知送信
            3. 失敗時は LINE Messaging API にフォールバック
```

## エンドポイント

### POST /api/chat/messages

メッセージを保存し、sender が "inhabitant" の場合は通知も送信する。

**リクエスト:**
```json
{
  "sender": "inhabitant",
  "content": "メッセージ"
}
```

**レスポンス:**
```json
{
  "message": {
    "id": "uuid",
    "sender": "inhabitant",
    "content": "メッセージ",
    "createdAt": 1234567890
  },
  "notified": {
    "method": "push",
    "success": true,
    "delivered": 1
  }
}
```

## データ保存

チャット履歴はデータディレクトリ内の `chat-messages.json` に保存される。

```json
{
  "version": 1,
  "messages": [
    {
      "id": "uuid",
      "sender": "inhabitant",
      "content": "メッセージ",
      "createdAt": 1234567890
    }
  ]
}
```

## 通知フォールバック

1. PWA Push 通知を試みる
2. 登録がない or 全て失敗 → LINE Messaging API にフォールバック（設定されている場合）

## 関連ファイル

- `app/server/chat/message-store.ts` - メッセージ永続化
- `app/server/push/notifier.ts` - 通知送信ロジック
- `app/public/sw.js` - Service Worker（Push 受信・表示）
