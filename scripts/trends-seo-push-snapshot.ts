/**
 * Grava agregação Google Trends BR em `trends_seo_snapshot`.
 * Fonte principal: crontab horário no servidor (docs/radar-snapshots.md).
 *
 *   npm run trends:push-snapshot
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pushTrendsSeoSnapshot } from "../src/lib/trends-seo-push-snapshot-core";

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
  const result = await pushTrendsSeoSnapshot();
  if (!result.ok) {
    console.error("[trends-seo-push-snapshot]", result.error);
    process.exit(1);
  }

  console.log(
    `[trends-seo-push-snapshot] ok — ${result.total} itens em ${new Date().toISOString()}`
  );
}

void main();
