#!/bin/bash

# ユーザーに選択肢を提示して、回答を待つ
# Socket.io 経由で talk ページに選択肢ボタンが表示される

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

RESPONSE=$(curl -s -X POST http://localhost:3000/api/ask \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    --max-time 300)

# 選択結果のテキストだけを返す
echo "$RESPONSE" | jq -r '.choice // .error // "error"'
