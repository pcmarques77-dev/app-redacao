/**
 * Rodar no servidor Linux (cron), no mesmo diretório do repo após `npm ci`:
 *
 *   export NEXT_PUBLIC_SUPABASE_URL="https://....supabase.co"
 *   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   npm run ronda:push-snapshot
 *
 * Grava dois registros: id 1 (Ronda Gov) e id 2 (Ronda Tech), na tabela `ronda_rss_snapshot`.
 *
 * Exemplo cron (a cada 10 min):
 *   0,10,20,30,40,50 * * * * cd /opt/app-redacao && . ./.env.ronda && npm run ronda:push-snapshot >> /var/log/ronda-rss.log 2>&1
 */
import { createClient } from "@supabase/supabase-js";
import {
  agregarRondaRss,
  type RondaRssKind,
} from "../src/lib/ronda-rss-agregado";
import { RONDA_RSS_SNAPSHOT_ROW } from "../src/lib/ronda-rss-snapshot";

/** Remove CRLF, espaços e aspas que `.env` copiado do Windows costuma trazer. */
function cleanEnvValue(raw: string | undefined): string {
  if (raw == null) return "";
  let s = raw.replace(/\r\n/g, "\n").replace(/\r/g, "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/** Corrige valor onde colaram por engano `NOME_VAR=...` outra vez dentro do valor. */
function normalizeSupabaseUrlFromEnv(raw: string | undefined): string {
  let s = cleanEnvValue(raw);
  s = s.replace(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*/i, "");
  s = s.replace(/^SUPABASE_URL\s*=\s*/i, "");
  return s.trim();
}

function normalizeServiceKeyFromEnv(raw: string | undefined): string {
  let s = cleanEnvValue(raw);
  s = s.replace(/^SUPABASE_SERVICE_ROLE_KEY\s*=\s*/i, "");
  return s.trim();
}

/** URL da API do projeto (Settings → API → Project URL), ex.: https://abcdefgh.supabase.co */
function assertSupabaseApiUrl(url: string) {
  const u = url.replace(/\/$/, "");
  const ok = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(u);
  if (ok) return;
  console.error(
    "[ronda-rss-push-snapshot] NEXT_PUBLIC_SUPABASE_URL inválida para a API REST.\n" +
      "No .env.ronda cada linha deve ser só: NOME=valor (sem repetir o nome no valor).\n" +
      "Ex.: NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co\n" +
      "Use o \"Project URL\" do painel (https://<ref>.supabase.co).\n" +
      `Valor atual (primeiros 100 chars): ${url.slice(0, 100)}`
  );
  process.exit(1);
}

async function main() {
  const url = normalizeSupabaseUrlFromEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  );
  const key = normalizeServiceKeyFromEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !key) {
    console.error(
      "Defina NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY."
    );
    process.exit(1);
  }

  assertSupabaseApiUrl(url);

  const apiUrl = url.replace(/\/$/, "");
  const supabase = createClient(apiUrl, key);

  const kinds: RondaRssKind[] = ["gov", "tech"];

  for (const kind of kinds) {
    const payload = await agregarRondaRss(kind);
    const id = RONDA_RSS_SNAPSHOT_ROW[kind];

    const { error } = await supabase.from("ronda_rss_snapshot").upsert(
      {
        id,
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
      console.error(`[ronda-rss-push-snapshot] ${kind} (id ${id}):`, short);
      process.exit(1);
    }

    console.log(
      `[ronda-rss-push-snapshot] ok ${kind} — ${payload.total} itens em ${new Date().toISOString()}`
    );
  }
}

void main();
