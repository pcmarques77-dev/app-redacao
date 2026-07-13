#!/usr/bin/env bash
# Wrapper para cron — carrega nvm (se existir) e roda o push de snapshots.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$APP_DIR"

if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  source "$HOME/.nvm/nvm.sh"
  nvm use 20 >/dev/null 2>&1 || true
fi

export PATH="$APP_DIR/node_modules/.bin:$PATH"
npm run ronda:push-snapshot
