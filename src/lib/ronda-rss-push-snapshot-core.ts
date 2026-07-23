import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  agregarRondaRss,
  type RondaRssKind,
} from "@/lib/ronda-rss-agregado";
import { RONDA_RSS_SNAPSHOT_ROW } from "@/lib/ronda-rss-snapshot";

export type PushRondaRssSnapshotResult =
  | { ok: true; kinds: RondaRssKind[]; totals: Record<RondaRssKind, number> }
  | { ok: false; error: string; kind?: RondaRssKind };

function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Agrega RSS gov/tech/inss/longevidade/jornais e grava em `ronda_rss_snapshot` (ids 1–5). */
export async function pushRondaRssSnapshots(): Promise<PushRondaRssSnapshotResult> {
  const supabase = getServiceClient();
  if (!supabase) {
    return {
      ok: false,
      error:
        "Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no servidor.",
    };
  }

  const kinds: RondaRssKind[] = [
    "gov",
    "tech",
    "inss",
    "longevidade",
    "jornais",
  ];
  const totals = {} as Record<RondaRssKind, number>;

  for (const kind of kinds) {
    const payload = await agregarRondaRss(kind);
    const id = RONDA_RSS_SNAPSHOT_ROW[kind];

    if (payload.total === 0) {
      console.warn(
        `[ronda-rss-push-snapshot] ${kind}: 0 itens — snapshot anterior mantido.`
      );
      totals[kind] = 0;
      continue;
    }

    const { error } = await supabase.from("ronda_rss_snapshot").upsert(
      {
        id,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      return { ok: false, error: error.message, kind };
    }

    totals[kind] = payload.total;
  }

  return { ok: true, kinds, totals };
}
