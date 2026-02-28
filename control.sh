[ -f .env ] && set -a && source .env && set +a
npx tsx cli/src/index.ts "$@"
