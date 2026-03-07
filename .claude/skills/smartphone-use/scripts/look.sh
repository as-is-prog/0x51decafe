#!/bin/bash
# 画面を見てテキストで報告する（スクショ/UI XMLはQwen3.5内で閉じる）
# Usage: look.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERIAL="${DEVICE_SERIAL:-}"

python3.11 "$SCRIPT_DIR/_lib/look.py" $SERIAL
