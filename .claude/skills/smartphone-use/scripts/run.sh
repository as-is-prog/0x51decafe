#!/bin/bash

# DroidRun + LMStudio で Android端末を自然言語操作する
# Usage: run.sh "自然言語の指示" ["モデル名"]

set -euo pipefail

GOAL="${1:?Usage: $0 \"指示\" [\"モデル名\"]}"
MODEL="${2:-qwen3.5-9b-uncensored-hauhaucs-aggressive}"
LMSTUDIO_URL="http://localhost:1234/v1"

# デバイスシリアル（環境変数で指定可、未指定なら自動検出）
SERIAL="${DEVICE_SERIAL:-}"

# デバイス引数の組み立て
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
    --no-stream
