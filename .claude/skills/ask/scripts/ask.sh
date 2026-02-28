#!/bin/bash

# ユーザーに選択肢を提示して、回答を待つ
# Socket.io 経由で talk ページに選択肢ボタンが表示される

source "$(dirname "$0")/../../_lib/api.sh"

if [ $# -lt 3 ]; then
    echo "Usage: $0 \"質問\" \"選択肢1\" \"選択肢2\" [\"選択肢3\" ...]"
    exit 1
fi

CONTENT="$1"
shift

# jq で安全に JSON を構築
CHOICES_JSON=$(printf '%s\n' "$@" | jq -R . | jq -s .)
PAYLOAD=$(jq -n --arg content "$CONTENT" --argjson choices "$CHOICES_JSON" \
    '{content: $content, choices: $choices}')

RESPONSE=$(api_curl -s -X POST "$API_BASE$(api_url /ask)" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    --max-time 300)

# 選択結果のテキストだけを返す
echo "$RESPONSE" | jq -r '.choice // .error // "error"'
