import { createClient } from "@supabase/supabase-js";
import type { RondaRssAgregadoOk, RondaRssKind } from "@/lib/ronda-rss-agregado";

export const RONDA_RSS_SNAPSHOT_ROW: Record<RondaRssKind, number> = {
  gov: 1,
  tech: 2,
};

function parsePayload(raw: unknown): RondaRssAgregadoOk | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.ok !== true) return null;
  if (!Array.isArray(o.noticias)) return null;
  const noticias = o.noticias.filter((n): n is RondaRssAgregadoOk["noticias"][number] => {
    if (!n || typeof n !== "object") return false;
    const r = n as Record<string, unknown>;
    return (
      typeof r.titulo === "string" &&
      typeof r.link === "string" &&
      typeof r.fonte === "string" &&
      typeof r.data_publicacao === "string" &&
      (r.publicado_em === null || typeof r.publicado_em === "string")
    );
  });
  const total = typeof o.total === "number" ? o.total : noticias.length;
  return { ok: true, noticias, total };
}

function createAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createClient(url, key);
}

/** Lê o snapshot gravado pelo scraper no Linux (`ronda_rss_snapshot`). */
export async function readRondaRssSnapshotFromDb(
  kind: RondaRssKind = "gov"
): Promise<RondaRssAgregadoOk | null> {
  const supabase = createAdmin();
  if (!supabase) return null;

  const id = RONDA_RSS_SNAPSHOT_ROW[kind];

  const { data, error } = await supabase
    .from("ronda_rss_snapshot")
    .select("payload")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[ronda-rss-snapshot]", error.message);
    return null;
  }

  return parsePayload(data?.payload);
}
