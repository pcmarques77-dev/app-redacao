/**
 * Rodar no servidor Linux (cron), no mesmo diretório do repo após `npm ci`:
 *
 *   export NEXT_PUBLIC_SUPABASE_URL="https://....supabase.co"
 *   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   npm run ronda:push-snapshot
 *
 * Grava dois registros: id 1 (Ronda Gov) e id 2 (Ronda Tech), na tabela `ronda_rss_snapshot`.
 *
 * Em produção na Vercel, o cron em `vercel.json` chama `/api/cron/ronda-rss-snapshot`
 * (requer `CRON_SECRET`). A leitura do Radar usa snapshot por padrão em produção.
 *
 * Exemplo cron Linux (a cada 10 min):
 *   0,10,20,30,40,50 * * * * cd /opt/app-redacao && . ./.env.ronda && npm run ronda:push-snapshot >> /var/log/ronda-rss.log 2>&1
 */
import { pushRondaRssSnapshots } from "../src/lib/ronda-rss-push-snapshot-core";

async function main() {
  const result = await pushRondaRssSnapshots();
  if (!result.ok) {
    console.error(
      `[ronda-rss-push-snapshot] ${result.kind ?? "all"}:`,
      result.error
    );
    process.exit(1);
  }

  for (const kind of result.kinds) {
    console.log(
      `[ronda-rss-push-snapshot] ok ${kind} — ${result.totals[kind]} itens em ${new Date().toISOString()}`
    );
  }
}

void main();
