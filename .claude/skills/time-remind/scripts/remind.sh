#!/bin/bash
# 時刻リマインド登録
# Usage: remind.sh HH:MM "理由" YYYY-MM-DD

TIME="$1"
REASON="$2"
DATE="$3"

if [ -z "$TIME" ] || [ -z "$REASON" ] || [ -z "$DATE" ]; then
  echo "Usage: remind.sh HH:MM \"理由\" YYYY-MM-DD"
  exit 1
fi

# TODO: daemon IPC経由でリマインド予約を登録する
# daemon側の remind 機能が実装されたら、以下のようなコマンドに置き換える:
#   SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
#   PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
#   DAEMON_CLI="$PROJECT_ROOT/daemon/src/cli.ts"
#   npx tsx "$DAEMON_CLI" remind set --time "$TIME" --reason "$REASON" --date "$DATE"

echo "Error: remind feature is not yet implemented in the daemon. (TODO)"
exit 1
