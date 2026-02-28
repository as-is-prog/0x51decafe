#!/bin/bash
# チャット履歴を取得するスクリプト
# 使い方: read.sh [--limit N] [--since TIME] [--search TEXT]

LIMIT=10
SINCE=""
SEARCH=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    --since)
      SINCE="$2"
      shift 2
      ;;
    --search)
      SEARCH="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# API URL を構築
URL="http://localhost:3000/api/chat/messages?limit=${LIMIT}"
[ -n "$SINCE" ] && URL="${URL}&since=$(echo -n "$SINCE" | jq -sRr @uri)"
[ -n "$SEARCH" ] && URL="${URL}&search=$(echo -n "$SEARCH" | jq -sRr @uri)"

# API 呼び出し & フォーマット
# jq の strftime は UTC なので、JST (+9h = 32400s) を加算
curl -s "$URL" | jq -r '
  .messages[] |
  (((.createdAt / 1000) + 32400) | strftime("[%m/%d %H:%M]")) + " " +
  (if .sender == "user" then "(user)" else "(inhabitant)" end) + " " +
  .content
'

# 既読更新: 読んだ時点の Unix ms を chat-last-read.json に書き込む
# TODO: DATA_HOME 環境変数を使用する（デフォルト: ~/.0x51decafe）
LAST_READ_FILE="${DATA_HOME:-${HOME}/.0x51decafe}/chat-last-read.json"
NOW_MS=$(date +%s)000
mkdir -p "$(dirname "$LAST_READ_FILE")"
echo "{\"lastReadAt\": ${NOW_MS}}" > "$LAST_READ_FILE"
