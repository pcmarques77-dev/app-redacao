import { createClient } from "@supabase/supabase-js";
import type { UltimaReportagem, UltimasVivaOk } from "@/lib/viva-ultimas";

const SNAPSHOT_ID = 1;

function createAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function parseReportagem(raw: unknown): UltimaReportagem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.titulo !== "string" || typeof row.link !== "string") return null;
  if (typeof row.editoria !== "string" || typeof row.publicadoEm !== "string") {
    return null;
  }
  return {
    titulo: row.titulo,
    link: row.link,
    editoria: row.editoria,
    publicadoEm: row.publicadoEm,
    subtitulo: typeof row.subtitulo === "string" ? row.subtitulo : null,
    autor: typeof row.autor === "string" ? row.autor : null,
  };
}

function parsePayload(raw: unknown): UltimasVivaOk | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.ok !== true || !Array.isArray(o.itens)) return null;
  const itens = o.itens
    .map(parseReportagem)
    .filter((item): item is UltimaReportagem => item != null);
  if (itens.length === 0) return null;
  const editorias = Array.isArray(o.editorias)
    ? o.editorias.filter((nome): nome is string => typeof nome === "string")
    : [];
  const avisos = Array.isArray(o.avisos)
    ? o.avisos.filter((aviso): aviso is string => typeof aviso === "string")
    : [];
  return {
    ok: true,
    itens,
    editorias,
    desde: typeof o.desde === "string" ? o.desde : "",
    atualizadoEm:
      typeof o.atualizadoEm === "string"
        ? o.atualizadoEm
        : new Date().toISOString(),
    avisos,
  };
}

/** Lê o último snapshot gravado. Não raspa o Viva. */
export async function readUltimasSnapshot(): Promise<UltimasVivaOk | null> {
  const supabase = createAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("ultimas_viva_snapshot")
    .select("payload")
    .eq("id", SNAPSHOT_ID)
    .maybeSingle();

  if (error) {
    console.error("[ultimas-snapshot]", error.message);
    return null;
  }

  return parsePayload(data?.payload);
}

/** Grava o agregado inteiro de uma vez, só depois da coleta terminar. */
export async function writeUltimasSnapshot(
  valor: UltimasVivaOk
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdmin();
  if (!supabase) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para esta operação.",
    };
  }

  const { error } = await supabase.from("ultimas_viva_snapshot").upsert({
    id: SNAPSHOT_ID,
    payload: valor,
    updated_at: new Date().toISOString(),
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
