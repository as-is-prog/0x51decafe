#!/bin/bash
# スキル共通ライブラリ: 認証付きAPIリクエスト
# 使い方: source "$(dirname "$0")/../../_lib/api.sh"

# プロジェクトルートを特定（.auth-token があるディレクトリを上方向に探索）
_find_project_root() {
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/.auth-token" ]; then
      echo "$dir"
      return
    fi
    dir="$(dirname "$dir")"
  done
  # fallback: スクリプト位置から辿る (.claude/skills/_lib/ → 3階層上)
  local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  echo "$(cd "$script_dir/../../.." && pwd)"
}

PROJECT_ROOT="$(_find_project_root)"
AUTH_TOKEN="$(cat "$PROJECT_ROOT/.auth-token" 2>/dev/null || echo "")"
API_BASE="http://localhost:${PORT:-3000}"

# インハビタントID解決
# daemon は cwd = inhabitantDir で CLI を起動するので、
# $PWD/inhabitant.yaml から id を読み取れる
_resolve_inhabitant_id() {
  # 1. 環境変数で明示指定
  if [ -n "$INHABITANT_ID" ]; then
    echo "$INHABITANT_ID"
    return
  fi
  # 2. カレントディレクトリの inhabitant.yaml から取得
  if [ -f "$PWD/inhabitant.yaml" ]; then
    grep '^id:' "$PWD/inhabitant.yaml" | head -1 | sed 's/^id:[[:space:]]*//'
    return
  fi
  # 3. フォールバック: 空文字（デフォルトインハビタント扱い）
  echo ""
}

INHABITANT_ID="$(_resolve_inhabitant_id)"

# インハビタント対応 API パス生成
# Usage: api_url "/chat/messages" → "/api/inhabitants/nor/chat/messages"
# INHABITANT_ID が空の場合は後方互換パスにフォールバック
api_url() {
  local path="$1"
  if [ -n "$INHABITANT_ID" ]; then
    echo "/api/inhabitants/${INHABITANT_ID}${path}"
  else
    echo "/api${path}"
  fi
}

# 認証付き curl ラッパー
# Usage: api_curl [curl options...]
# Example: api_curl -s -X POST "$API_BASE$(api_url /speak)" -d "$BODY"
api_curl() {
  curl -H "Authorization: Bearer $AUTH_TOKEN" "$@"
}
