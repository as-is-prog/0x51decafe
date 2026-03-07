#!/bin/bash
# Wake予約管理
# Usage: wake.sh <command> [options]
#   wake.sh set --time HH:MM --reason "理由" [--date YYYY-MM-DD]
#   wake.sh list
#   wake.sh cancel --id <uuid> | --all
#   wake.sh check [--hours 12]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INHABITANT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
PROJECT_ROOT="$(cd "$INHABITANT_DIR/../.." && pwd)"
DAEMON_CLI="$PROJECT_ROOT/daemon/src/cli.ts"

npx tsx "$DAEMON_CLI" wake "$@" --inhabitant-dir "$INHABITANT_DIR"
