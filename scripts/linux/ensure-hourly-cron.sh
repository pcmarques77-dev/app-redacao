#!/usr/bin/env bash
# Garante crontab horário para snapshots do Radar (RSS + Trends).
# Uso no servidor:
#   bash scripts/linux/ensure-hourly-cron.sh
#
# Substitui qualquer linha antiga de run-ronda-snapshot.sh (ex.: 3x/dia)
# por: 0 * * * * (a cada hora, minuto 0).

set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/app-redacao}"
CRON_SCHEDULE="${CRON_SCHEDULE:-0 * * * *}"
WRAPPER="$APP_DIR/scripts/linux/run-ronda-snapshot.sh"
CRON_LINE="$CRON_SCHEDULE cd $APP_DIR && $WRAPPER >> $APP_DIR/logs/ronda-snapshot.log 2>&1"

mkdir -p "$APP_DIR/logs"
chmod +x "$WRAPPER" 2>/dev/null || true

EXISTING="$(crontab -l 2>/dev/null || true)"
# Remove linhas antigas deste job (qualquer schedule).
FILTERED="$(printf '%s\n' "$EXISTING" | grep -vF "run-ronda-snapshot.sh" || true)"
# Evita linha em branco extra no fim.
if [[ -n "${FILTERED//[[:space:]]/}" ]]; then
  printf '%s\n%s\n' "$FILTERED" "$CRON_LINE" | crontab -
else
  printf '%s\n' "$CRON_LINE" | crontab -
fi

echo "==> Crontab horário instalado:"
echo "    $CRON_LINE"
echo ""
echo "Confira com: crontab -l"
echo "Push agora (opcional): cd $APP_DIR && npm run ronda:push-snapshot && npm run trends:push-snapshot"
