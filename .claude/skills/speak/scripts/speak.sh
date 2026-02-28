#!/bin/bash

# ユーザーにリアルタイムで話しかける
# Socket.io 経由で talk ページに即座に届く（履歴保存なし）

# 引数チェック
if [ -z "$1" ]; then
    echo "Usage: $0 \"メッセージ\" [surface]"
    exit 1
fi

MESSAGE="$1"
SURFACE="${2:-0}"

# アプリサーバーの speak エンドポイントに送信
BODY=$(jq -n --arg content "$MESSAGE" --argjson surface "$SURFACE" '{"content": $content, "surface": $surface}')
RESPONSE=$(curl -s -X POST http://localhost:3000/api/speak \
    -H "Content-Type: application/json" \
    -d "$BODY")

echo "$RESPONSE"
