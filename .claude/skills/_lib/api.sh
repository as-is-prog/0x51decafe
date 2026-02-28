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

# 認証付き curl ラッパー
# Usage: api_curl [curl options...]
# Example: api_curl -s -X POST "$API_BASE/api/speak" -d "$BODY"
api_curl() {
  curl -H "Authorization: Bearer $AUTH_TOKEN" "$@"
}
