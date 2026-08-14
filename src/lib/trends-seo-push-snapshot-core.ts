import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  agregarTrendsSeo,
  type TrendsSeoAgregadoOk,
} from "@/lib/trends-seo";
import { TRENDS_SEO_SNAPSHOT_ID } from "@/lib/trends-seo-snapshot";

export type PushTrendsSeoSnapshotResult =
  | { ok: true; total: number; payload: TrendsSeoAgregadoOk }
  | { ok: false; error: string };

function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Busca Trends BR e grava em `trends_seo_snapshot`. */
export async function pushTrendsSeoSnapshot(): Promise<PushTrendsSeoSnapshotResult> {
  const supabase = getServiceClient();
  if (!supabase) {
    return {
      ok: false,
      error:
        "Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no servidor.",
    };
  }

  let payload: TrendsSeoAgregadoOk;
  try {
    payload = await agregarTrendsSeo();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  if (payload.total === 0) {
    console.warn(
      "[trends-seo-push-snapshot] 0 itens — snapshot anterior mantido."
    );
    return { ok: true, total: 0, payload };
  }

  const { error } = await supabase.from("trends_seo_snapshot").upsert(
    {
      id: TRENDS_SEO_SNAPSHOT_ID,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, total: payload.total, payload };
}
