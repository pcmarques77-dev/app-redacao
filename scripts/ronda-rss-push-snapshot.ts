/**
 * Grava agregação RSS em `ronda_rss_snapshot` (ids 1=Gov, 2=Tech, 3=INSS, 4=Longevidade, 5=Jornais).
 * Fonte principal: crontab horário no servidor (docs/radar-snapshots.md).
 * Necessário para rondas Google Notícias na Vercel (feeds bloqueados no datacenter).
 *
 *   npm run ronda:push-snapshot
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pushRondaRssSnapshots } from "../src/lib/ronda-rss-push-snapshot-core";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = val;
  }
}

loadEnvLocal();

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
