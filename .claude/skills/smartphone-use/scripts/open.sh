#!/bin/bash
# アプリを起動して画面状態を報告する
# Usage: open.sh "アプリ名またはパッケージ名"

set -euo pipefail

APP="${1:?Usage: $0 \"アプリ名またはパッケージ名\"}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERIAL="${DEVICE_SERIAL:-}"
ADB_CMD="adb${SERIAL:+ -s $SERIAL}"

# パッケージ名かアプリ名かを判定して起動
if [[ "$APP" == *.* ]]; then
    # パッケージ名（com.example.app 形式）
    $ADB_CMD shell monkey -p "$APP" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
else
    # アプリ名 → パッケージ名を検索（アプリラベルから逆引き）
    PKG=$($ADB_CMD shell cmd package query-activities -a android.intent.action.MAIN -c android.intent.category.LAUNCHER 2>/dev/null \
        | grep -i "$APP" -A5 | grep "packageName" | head -1 | sed 's/.*packageName=//' | tr -d '[:space:]')
    # fallback: パッケージ名直接検索
    if [ -z "$PKG" ]; then
        PKG=$($ADB_CMD shell pm list packages 2>/dev/null | grep -i "$APP" | head -1 | sed 's/package://')
    fi
    if [ -z "$PKG" ]; then
        echo "ERROR: アプリ '$APP' が見つかりません" >&2
        exit 1
    fi
    $ADB_CMD shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
fi

sleep 1.5
python3.11 "$SCRIPT_DIR/_lib/look.py" $SERIAL
