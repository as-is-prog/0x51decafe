#!/bin/bash
# 戻るボタンを押して画面状態を報告する
# Usage: back.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERIAL="${DEVICE_SERIAL:-}"
ADB_CMD="adb${SERIAL:+ -s $SERIAL}"

$ADB_CMD shell input keyevent KEYCODE_BACK
sleep 1
python3.11 "$SCRIPT_DIR/_lib/look.py" $SERIAL
