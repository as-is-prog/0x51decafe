#!/bin/bash
# 短い指示をDroidRunに投げて実行する（3〜5ステップ）
# Usage: do.sh "短い指示" [ステップ数]

set -euo pipefail

GOAL="${1:?Usage: $0 \"短い指示\" [ステップ数]}"
STEPS="${2:-5}"
MODEL="qwen3.5-9b-uncensored-hauhaucs-aggressive"
LMSTUDIO_URL="http://localhost:1234/v1"

SERIAL="${DEVICE_SERIAL:-}"
DEVICE_ARGS=""
if [ -n "$SERIAL" ]; then
    DEVICE_ARGS="-d $SERIAL"
fi

python3.11 -m droidrun run "$GOAL" \
    $DEVICE_ARGS \
    -p OpenAILike \
    -m "$MODEL" \
    --api_base "$LMSTUDIO_URL" \
    --vision \
    --no-reasoning \
    --no-tracing \
    --no-stream \
    --steps "$STEPS"
