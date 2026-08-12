import { createClient } from "@supabase/supabase-js";
import type { TrendSeoItem, TrendsSeoAgregadoOk } from "@/lib/trends-seo";

export const TRENDS_SEO_SNAPSHOT_ID = 1;

function isTrendItem(n: unknown): n is TrendSeoItem {
  if (!n || typeof n !== "object") return false;
  const r = n as Record<string, unknown>;
  return (
    typeof r.titulo === "string" &&
    typeof r.link === "string" &&
    r.fonte === "Google Trends" &&
    typeof r.data_publicacao === "string" &&
    (r.publicado_em === null || typeof r.publicado_em === "string") &&
    (r.destaque === null || typeof r.destaque === "string") &&
    typeof r.volumeOrdenacao === "number"
  );
}

function parsePayload(raw: unknown): TrendsSeoAgregadoOk | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.ok !== true) return null;
  if (!Array.isArray(o.noticias)) return null;
  const noticias = o.noticias.filter(isTrendItem);
  const total = typeof o.total === "number" ? o.total : noticias.length;
  const fonte =
    o.fonte === "google-trends-batchexecute" || o.fonte === "google-trends-rss"
      ? o.fonte
      : "google-trends-batchexecute";

  return {
    ok: true,
    noticias,
    total,
    geo: "BR",
    fonte,
  };
}

function createAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createClient(url, key);
}

/** Lê o snapshot gravado pelo job (`trends_seo_snapshot`). */
export async function readTrendsSeoSnapshotFromDb(): Promise<TrendsSeoAgregadoOk | null> {
  const supabase = createAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("trends_seo_snapshot")
    .select("payload")
    .eq("id", TRENDS_SEO_SNAPSHOT_ID)
    .maybeSingle();

  if (error) {
    console.error("[trends-seo-snapshot]", error.message);
    return null;
  }

  return parsePayload(data?.payload);
}
