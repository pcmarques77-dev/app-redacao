"use server";

import { createClient } from "@supabase/supabase-js";
import { getAdminActor } from "@/app/actions/admin";
import { notifyEditorsDemandaMultimidia } from "@/lib/demanda-multimidia-email";
import {
  PAUTA_ACCESS_DENIED,
  coercePautaStatus,
  isPautaStatus,
  type CreatePautaInput,
  type PautaDashboardRow,
  type UpdatePautaPatch,
} from "@/lib/pautas-shared";

const UPDATE_KEYS = new Set([
  "titulo_provisorio",
  "fontes",
  "arquivos_urls",
  "editoria",
  "deadline",
  "status",
  "reporter_id",
  "demanda_multimidia",
]);

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function isPrivileged(actor: {
  isSuperAdmin: boolean;
  isEditor: boolean;
}): boolean {
  return actor.isSuperAdmin || actor.isEditor;
}

function canModifyRow(
  actor: {
    userId: string;
    isSuperAdmin: boolean;
    isEditor: boolean;
  },
  rowReporterId: string | null
): boolean {
  if (isPrivileged(actor)) return true;
  return (rowReporterId ?? "").trim() === actor.userId;
}

/** Sessão atual + função (para UI de pautas no cliente). */
export async function getPautaSessionAction(): Promise<
  | {
      ok: true;
      userId: string;
      email: string;
      nome: string | null;
      funcao: string | null;
      isSuperAdmin: boolean;
      isEditor: boolean;
    }
  | { ok: false; error: string }
> {
  const actor = await getAdminActor();
  if (!actor.ok) return { ok: false, error: actor.error };
  return {
    ok: true,
    userId: actor.userId,
    email: actor.email,
    nome: actor.nome,
    funcao: actor.funcao,
    isSuperAdmin: actor.isSuperAdmin,
    isEditor: actor.isEditor,
  };
}

export async function listPautasDashboardAction(): Promise<
  | { ok: true; rows: PautaDashboardRow[] }
  | { ok: false; error: string }
> {
  const actor = await getAdminActor();
  if (!actor.ok) return { ok: false, error: actor.error };

  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para esta operação.",
    };
  }

  const q = admin
    .from("pautas")
    .select(
      `
        id,
        titulo_provisorio,
        editoria,
        deadline,
        status,
        reporter_id,
        demanda_multimidia,
        reporter:usuarios!pautas_reporter_id_fkey(nome)
      `
    )
    .order("deadline", { ascending: true, nullsFirst: false });

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  const rows = ((data ?? []) as unknown as PautaDashboardRow[]).map((row) => {
    const rawStatus =
      typeof row.status === "string" || row.status === null
        ? row.status
        : null;
    const rawDm = (row as { demanda_multimidia?: unknown }).demanda_multimidia;
    return {
      ...row,
      status: coercePautaStatus(rawStatus),
      demanda_multimidia: rawDm === true,
    };
  });
  return { ok: true, rows };
}

export async function createPautaAction(
  input: CreatePautaInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getAdminActor();
  if (!actor.ok) return { ok: false, error: actor.error };

  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para esta operação.",
    };
  }

  const titulo = input.titulo_provisorio?.trim() ?? "";
  if (!titulo) return { ok: false, error: "Informe o título provisório." };

  const privileged = isPrivileged(actor);
  const requested = (input.reporter_id ?? "").trim();
  const reporter_id = privileged ? requested : actor.userId;

  if (privileged && !reporter_id) {
    return { ok: false, error: "Selecione um repórter." };
  }

  const arquivos =
    input.arquivos_urls != null && input.arquivos_urls !== undefined
      ? input.arquivos_urls
      : [];

  const statusRaw = (input.status ?? "").trim() || "Sugerida";
  if (!isPautaStatus(statusRaw)) {
    return { ok: false, error: "Status da pauta inválido." };
  }

  const demanda_multimidia = input.demanda_multimidia === true;

  const { error } = await admin.from("pautas").insert({
    titulo_provisorio: titulo,
    fontes: input.fontes?.trim() ? input.fontes.trim() : null,
    arquivos_urls: arquivos,
    editoria: input.editoria?.trim() || "Últimas Notícias",
    deadline: input.deadline?.trim() ?? "",
    status: statusRaw,
    reporter_id,
    demanda_multimidia,
  });

  if (error) return { ok: false, error: error.message };

  if (demanda_multimidia) {
    const { data: repRow } = await admin
      .from("usuarios")
      .select("nome")
      .eq("id", reporter_id)
      .maybeSingle();
    const reporterNome = repRow?.nome?.trim() || "—";
    await notifyEditorsDemandaMultimidia(admin, {
      titulo: titulo,
      reporterNome,
      resumo: input.fontes?.trim() ? input.fontes.trim() : null,
    });
  }

  return { ok: true };
}

export async function updatePautaAction(
  id: string,
  patch: UpdatePautaPatch
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getAdminActor();
  if (!actor.ok) return { ok: false, error: actor.error };

  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para esta operação.",
    };
  }

  const pautaId = id?.trim();
  if (!pautaId) return { ok: false, error: "ID da pauta inválido." };

  const { data: existing, error: selErr } = await admin
    .from("pautas")
    .select("reporter_id")
    .eq("id", pautaId)
    .maybeSingle();

  if (selErr) return { ok: false, error: selErr.message };
  if (!existing) return { ok: false, error: "Pauta não encontrada." };

  if (!canModifyRow(actor, existing.reporter_id as string | null)) {
    return { ok: false, error: PAUTA_ACCESS_DENIED };
  }

  let patchToApply = patch;
  if (patch.status !== undefined) {
    const s = String(patch.status).trim();
    if (!isPautaStatus(s)) {
      return { ok: false, error: "Status da pauta inválido." };
    }
    patchToApply = { ...patch, status: s };
  }

  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patchToApply)) {
    if (!UPDATE_KEYS.has(k)) continue;
    if (v === undefined) continue;
    if (k === "demanda_multimidia") {
      sanitized[k] = v === true;
      continue;
    }
    sanitized[k] = v;
  }

  if (Object.keys(sanitized).length === 0) {
    return { ok: false, error: "Nada para atualizar." };
  }

  if (!isPrivileged(actor)) {
    delete sanitized.reporter_id;
    sanitized.reporter_id = (existing.reporter_id as string | null) ?? actor.userId;
  }

  const { error: upErr } = await admin
    .from("pautas")
    .update(sanitized)
    .eq("id", pautaId);

  if (upErr) return { ok: false, error: upErr.message };

  if (sanitized.demanda_multimidia === true) {
    const { data: pRow } = await admin
      .from("pautas")
      .select(
        "titulo_provisorio, fontes, reporter:usuarios!pautas_reporter_id_fkey(nome)"
      )
      .eq("id", pautaId)
      .maybeSingle();

    if (pRow) {
      const titulo = (pRow as { titulo_provisorio?: string | null })
        .titulo_provisorio?.trim() || "Sem título";
      const resumo = (pRow as { fontes?: string | null }).fontes ?? null;
      const rep = (pRow as { reporter?: { nome?: string | null } | null })
        .reporter;
      const reporterNome = rep?.nome?.trim() || "—";
      await notifyEditorsDemandaMultimidia(admin, {
        titulo,
        reporterNome,
        resumo,
      });
    }
  }

  return { ok: true };
}

export async function deletePautasAction(
  ids: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getAdminActor();
  if (!actor.ok) return { ok: false, error: actor.error };

  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para esta operação.",
    };
  }

  const cleanIds = [...new Set(ids.map((x) => x.trim()).filter(Boolean))];
  if (cleanIds.length === 0) return { ok: false, error: "Nenhuma pauta selecionada." };

  const { data: rows, error: selErr } = await admin
    .from("pautas")
    .select("id, reporter_id")
    .in("id", cleanIds);

  if (selErr) return { ok: false, error: selErr.message };

  const found = rows ?? [];
  if (found.length !== cleanIds.length) {
    return { ok: false, error: "Uma ou mais pautas não foram encontradas." };
  }

  for (const row of found) {
    if (!canModifyRow(actor, row.reporter_id as string | null)) {
      return { ok: false, error: PAUTA_ACCESS_DENIED };
    }
  }

  const { error: delErr } = await admin.from("pautas").delete().in("id", cleanIds);
  if (delErr) return { ok: false, error: delErr.message };
  return { ok: true };
}
