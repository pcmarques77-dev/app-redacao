/**
 * Rodar no servidor Linux (cron), no mesmo diretório do repo após `npm ci`:
 *
 *   export NEXT_PUBLIC_SUPABASE_URL="https://....supabase.co"
 *   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   npm run ronda:push-snapshot
 *
 * Exemplo cron (a cada 10 min):
 *   0,10,20,30,40,50 * * * * cd /opt/app-redacao && . ./.env.ronda && npm run ronda:push-snapshot >> /var/log/ronda-rss.log 2>&1
 */
import { createClient } from "@supabase/supabase-js";
import { agregarRondaRss } from "../src/lib/ronda-rss-agregado";

async function main() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    console.error(
      "Defina NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY."
    );
    process.exit(1);
  }

  const payload = await agregarRondaRss();
  const supabase = createClient(url, key);

  const { error } = await supabase.from("ronda_rss_snapshot").upsert(
    {
      id: 1,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("[ronda-rss-push-snapshot]", error.message);
    process.exit(1);
  }

  console.log(
    `[ronda-rss-push-snapshot] ok — ${payload.total} itens em ${new Date().toISOString()}`
  );
}

void main();
