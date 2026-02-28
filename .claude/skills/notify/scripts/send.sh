#!/bin/bash

# チャット履歴に保存 + Push 通知を送信

source "$(dirname "$0")/../../_lib/api.sh"

# 引数チェック
if [ -z "$1" ]; then
    echo "Usage: $0 \"メッセージ\""
    exit 1
fi

MESSAGE="$1"

# アプリサーバーにメッセージを送信（履歴保存 + Push通知）
RESPONSE=$(api_curl -s -X POST "$API_BASE$(api_url /chat/messages)" \
    -H "Content-Type: application/json" \
    -d "{\"sender\": \"inhabitant\", \"content\": \"$MESSAGE\"}")

echo "$RESPONSE"
