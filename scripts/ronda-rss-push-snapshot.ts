/**
 * Opcional: grava agregação RSS em `ronda_rss_snapshot` (ids 1=Gov, 2=Tech).
 * O Radar em produção lê feeds ao vivo via `/api/ronda-rss` — este script não é necessário no fluxo normal.
 *
 *   export NEXT_PUBLIC_SUPABASE_URL="https://....supabase.co"
 *   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   npm run ronda:push-snapshot
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
