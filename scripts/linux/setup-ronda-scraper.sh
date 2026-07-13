#!/usr/bin/env bash
# Configura o Mac Mini / servidor Linux para atualizar snapshots RSS no Supabase.
# Uso (no servidor, após git clone):
#   bash scripts/linux/setup-ronda-scraper.sh
#
# Depois edite ~/app-redacao/.env.local com as chaves Supabase e rode:
#   npm run ronda:push-snapshot

set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/app-redacao}"
REPO_URL="${REPO_URL:-https://github.com/pcmarques77-dev/app-redacao.git}"
CRON_SCHEDULE="${CRON_SCHEDULE:-0 10,16,22 * * *}"  # ~07h, 13h, 19h BRT

echo "==> Diretório: $APP_DIR"

if [[ -d "$APP_DIR/.git" ]]; then
  echo "==> Atualizando repositório..."
  git -C "$APP_DIR" pull --ff-only
else
  echo "==> Clonando repositório..."
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  source "$HOME/.nvm/nvm.sh"
  nvm install 20
  nvm use 20
fi

echo "==> Node $(node -v)"
echo "==> Instalando dependências..."
npm ci

ENV_FILE="$APP_DIR/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
EOF
  chmod 600 "$ENV_FILE"
  echo ""
  echo "!! Preencha $ENV_FILE com as chaves Supabase antes de continuar."
  echo "   (mesmos valores da Vercel / .env.local do dev)"
  exit 0
fi

echo "==> Testando push de snapshot..."
npm run ronda:push-snapshot

WRAPPER="$APP_DIR/scripts/linux/run-ronda-snapshot.sh"
CRON_LINE="$CRON_SCHEDULE cd $APP_DIR && $WRAPPER >> $APP_DIR/logs/ronda-snapshot.log 2>&1"

mkdir -p "$APP_DIR/logs"
chmod +x "$WRAPPER"

EXISTING="$(crontab -l 2>/dev/null || true)"
if echo "$EXISTING" | grep -Fq "run-ronda-snapshot.sh"; then
  echo "==> Cron já configurado."
else
  (echo "$EXISTING"; echo "$CRON_LINE") | crontab -
  echo "==> Cron adicionado: $CRON_SCHEDULE"
fi

echo ""
echo "Pronto. Logs em: $APP_DIR/logs/ronda-snapshot.log"
echo "Teste manual: npm run ronda:push-snapshot"
