#!/bin/bash
# 0x51decafe 起動スクリプト
#
# - tmux セッション "0x51decafe-<inhabitant-id>" がなければ作成して起動
# - すでにあればその旨を表示
# - デーモン内部で exit code 100 を返すとリロード（自動再起動）
#
# Usage:
#   ./daemon/run.sh <inhabitant-dir>            — デーモンを起動（tmuxセッション作成）
#   ./daemon/run.sh <inhabitant-dir> attach     — 既存セッションにアタッチ

set -e

CHAR_DIR="${1:?Usage: ./daemon/run.sh <inhabitant-dir> [attach]}"
CHAR_DIR="$(cd "$CHAR_DIR" && pwd)"  # resolve to absolute
CHAR_ID="$(basename "$CHAR_DIR")"
SESSION_NAME="0x51decafe-${CHAR_ID}"

# フレームワークルート（このスクリプトの親ディレクトリ）
FRAMEWORK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# サブコマンド
case "${2:-}" in
  attach)
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
      tmux attach-session -t "$SESSION_NAME"
    else
      echo "セッション '$SESSION_NAME' は存在しません。引数なしで起動してください。"
      exit 1
    fi
    ;;
  *)
    # メインロジック: セッション存在チェック
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
      echo "0x51decafe は既に起動中です (tmux session: $SESSION_NAME)"
      echo "  アタッチ: ./daemon/run.sh $CHAR_DIR attach"
      echo "  リロード: npx tsx daemon/src/index.ts daemon reload --inhabitant-dir $CHAR_DIR"
      echo "  停止:     npx tsx daemon/src/index.ts daemon stop --inhabitant-dir $CHAR_DIR"
      exit 0
    fi

    # tmux セッション作成 & リロードループで起動
    tmux new-session -d -s "$SESSION_NAME" bash -c '
      cd "'"$FRAMEWORK_ROOT"'"
      while true; do
        echo "[$(date "+%Y-%m-%d %H:%M:%S")] 0x51decafe starting..."
        npx tsx daemon/src/index.ts daemon run --inhabitant-dir "'"$CHAR_DIR"'"
        EXIT_CODE=$?
        if [ $EXIT_CODE -eq 100 ]; then
          echo "[$(date "+%Y-%m-%d %H:%M:%S")] Reloading (exit code 100)..."
          sleep 1
          continue
        fi
        echo "[$(date "+%Y-%m-%d %H:%M:%S")] Exited with code $EXIT_CODE"
        break
      done
    '

    # 起動確認
    sleep 2
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
      echo "0x51decafe started (tmux session: $SESSION_NAME)"
    else
      echo "0x51decafe の起動に失敗しました"
      exit 1
    fi
    ;;
esac
