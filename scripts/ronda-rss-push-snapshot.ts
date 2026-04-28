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

/** URL da API do projeto (Settings → API → Project URL), ex.: https://abcdefgh.supabase.co */
function assertSupabaseApiUrl(url: string) {
  const u = url.replace(/\/$/, "");
  const ok = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(u);
  if (ok) return;
  console.error(
    "[ronda-rss-push-snapshot] NEXT_PUBLIC_SUPABASE_URL inválida para a API REST.\n" +
      "Use exatamente o \"Project URL\" do painel: https://<ref>.supabase.co\n" +
      "Não use link do Dashboard (supabase.com/dashboard), nem /project/… .\n" +
      `Valor atual (primeiros 80 chars): ${url.slice(0, 80)}`
  );
  process.exit(1);
}

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

  assertSupabaseApiUrl(url);

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
    const msg = error.message?.replace(/\s+/g, " ").trim() ?? "";
    const short =
      msg.length > 240 || msg.includes("<!DOCTYPE")
        ? `${msg.slice(0, 200)}… (resposta parece HTML — confira Project URL e service_role)`
        : msg;
    console.error("[ronda-rss-push-snapshot]", short);
    process.exit(1);
  }

  console.log(
    `[ronda-rss-push-snapshot] ok — ${payload.total} itens em ${new Date().toISOString()}`
  );
}

void main();
