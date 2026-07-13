"use server";

import { revalidatePath } from "next/cache";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAdminActor } from "@/app/actions/admin";
import {
  canManageStreamyardEntry,
  isEditorRole,
  isSuperAdminEmail,
} from "@/lib/admin-acl";
import {
  ESCALA_TIPO_PLANTAO,
  ESCALA_TIPO_STREAMYARD,
  isStreamyardTipo,
  normalizeStreamyardHorario,
} from "@/lib/escala-constants";
import {
  dashboardEscalaQueryRange,
  plannerQueryRangeYm,
  type DashboardEscalaQueryInput,
} from "@/lib/escala-query-range";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ESCALA_ACCESS_DENIED =
  "Acesso negado. Apenas editores podem gerenciar a escala.";

const STREAMYARD_ACCESS_DENIED =
  "Você não pode gerenciar esta marcação Streamyard.";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Linha de escala com join em `usuarios` (nomes nos cards do calendário). */
export type EscalaDashboardRow = {
  id: string;
  tipo: string | null;
  usuario_id: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  coordenador: string | null;
  horario: string | null;
  usuarios: { nome: string | null } | null;
};

const ESCALA_DASHBOARD_SELECT = `
        id,
        tipo,
        usuario_id,
        data_inicio,
        data_fim,
        coordenador,
        horario,
        usuarios ( nome )
      `;

/** Escalas que intersectam um intervalo de datas (plantões, férias, feriados, Streamyard). */
export async function queryEscalasOverlappingRange(
  admin: SupabaseClient,
  rangeStart: string,
  rangeEnd: string
): Promise<
  | { ok: true; rows: EscalaDashboardRow[] }
  | { ok: false; error: string }
> {
  const [{ data: inRange, error: e1 }, { data: crossesIn, error: e2 }] =
    await Promise.all([
      admin
        .from("escalas")
        .select(ESCALA_DASHBOARD_SELECT)
        .gte("data_inicio", rangeStart)
        .lte("data_inicio", rangeEnd),
      admin
        .from("escalas")
        .select(ESCALA_DASHBOARD_SELECT)
        .lt("data_inicio", rangeStart)
        .not("data_fim", "is", null)
        .gte("data_fim", rangeStart),
    ]);

  if (e1) return { ok: false, error: e1.message };
  if (e2) return { ok: false, error: e2.message };

  const map = new Map<string, EscalaDashboardRow>();
  const ingest = (rows: unknown) => {
    for (const row of (rows ?? []) as EscalaDashboardRow[]) {
      map.set(row.id, row);
    }
  };
  ingest(inRange);
  ingest(crossesIn);

  const rows = [...map.values()].sort((a, b) =>
    (a.data_inicio ?? "").localeCompare(b.data_inicio ?? "")
  );

  return { ok: true, rows };
}

/**
 * Lista escalas para o painel no intervalo visível do calendário.
 * Usa service role no join com `usuarios`, pois no cliente o embed fica vazio com RLS restritivo.
 */
export async function listEscalasForDashboardAction(
  input: DashboardEscalaQueryInput
): Promise<
  | { ok: true; rows: EscalaDashboardRow[] }
  | { ok: false; error: string }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { ok: false, error: "Sessão inválida. Faça login novamente." };
  }

  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para esta operação.",
    };
  }

  const { rangeStart, rangeEnd } = dashboardEscalaQueryRange(input);
  return queryEscalasOverlappingRange(admin, rangeStart, rangeEnd);
}

async function assertCanManageEscala(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { ok: false, error: "Sessão inválida. Faça login novamente." };
  }
  const { data: row } = await supabase
    .from("usuarios")
    .select("funcao")
    .eq("id", user.id)
    .maybeSingle();
  const funcao = row?.funcao ?? null;
  if (isSuperAdminEmail(user.email) || isEditorRole(funcao)) {
    return { ok: true };
  }
  return { ok: false, error: ESCALA_ACCESS_DENIED };
}

/**
 * Escalas que intersectam o mês (plantões, férias, feriados no período).
 * Para editores planejarem fins de semana; dados são os mesmos do calendário geral.
 */
export async function listEscalasOverlappingMonthPlannerAction(
  year: number,
  monthIndex: number
): Promise<
  | { ok: true; rows: EscalaDashboardRow[] }
  | { ok: false; error: string }
> {
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(monthIndex) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    return { ok: false, error: "Mês inválido." };
  }

  const supabase = await createServerSupabaseClient();
  const gate = await assertCanManageEscala(supabase);
  if (!gate.ok) return gate;

  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para esta operação.",
    };
  }

  const { rangeStart, rangeEnd } = plannerQueryRangeYm(year, monthIndex);
  return queryEscalasOverlappingRange(admin, rangeStart, rangeEnd);
}

/** Adiciona um plantão na data. Permite vários por dia; evita repetir o mesmo jornalista no mesmo dia. */
export async function savePlantaoForDateAction(
  dateYmd: string,
  usuarioId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmedDate = dateYmd.trim();
  const trimmedUser = usuarioId.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate) || !trimmedUser) {
    return { ok: false, error: "Data ou jornalista inválido." };
  }

  const supabase = await createServerSupabaseClient();
  const gate = await assertCanManageEscala(supabase);
  if (!gate.ok) return gate;

  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para esta operação.",
    };
  }

  const { data: dupRows, error: dupErr } = await admin
    .from("escalas")
    .select("id")
    .eq("tipo", ESCALA_TIPO_PLANTAO)
    .eq("data_inicio", trimmedDate)
    .eq("usuario_id", trimmedUser)
    .limit(1);

  if (dupErr) return { ok: false, error: dupErr.message };
  if (dupRows && dupRows.length > 0) {
    return {
      ok: false,
      error: "Este jornalista já está de plantão neste dia.",
    };
  }

  const payload = {
    tipo: ESCALA_TIPO_PLANTAO,
    usuario_id: trimmedUser,
    data_inicio: trimmedDate,
    data_fim: null,
    coordenador: null,
    horario: null,
  };

  const { error } = await supabase.from("escalas").insert(payload);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/escala");
  revalidatePath("/escala/plantoes");
  return { ok: true };
}

/** Move um plantão já salvo para outro dia (mesmo comportamento de arrastar pautas no calendário). */
export async function movePlantaoToDateAction(
  escalaId: string,
  targetDateYmd: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = escalaId?.trim();
  const target = targetDateYmd?.trim();
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(target)) {
    return { ok: false, error: "Dados inválidos." };
  }

  const supabase = await createServerSupabaseClient();
  const gate = await assertCanManageEscala(supabase);
  if (!gate.ok) return gate;

  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para esta operação.",
    };
  }

  const { data: row, error: fetchErr } = await admin
    .from("escalas")
    .select("id, tipo, usuario_id, data_inicio")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!row || (row.tipo ?? "").trim() !== ESCALA_TIPO_PLANTAO) {
    return { ok: false, error: "Plantão não encontrado." };
  }

  const uid = row.usuario_id?.trim();
  const fromDate = row.data_inicio?.trim();
  if (!uid || !fromDate) {
    return { ok: false, error: "Plantão inválido." };
  }

  if (fromDate === target) {
    return { ok: true };
  }

  const { data: dupRows, error: dupErr } = await admin
    .from("escalas")
    .select("id")
    .eq("tipo", ESCALA_TIPO_PLANTAO)
    .eq("data_inicio", target)
    .eq("usuario_id", uid)
    .neq("id", id)
    .limit(1);

  if (dupErr) return { ok: false, error: dupErr.message };
  if (dupRows && dupRows.length > 0) {
    return {
      ok: false,
      error: "Este jornalista já está de plantão neste dia.",
    };
  }

  const { error: updErr } = await supabase
    .from("escalas")
    .update({ data_inicio: target })
    .eq("id", id);

  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/");
  revalidatePath("/escala");
  revalidatePath("/escala/plantoes");
  return { ok: true };
}

/** Remove todos os plantões marcados exatamente neste dia (planejador). */
export async function clearPlantoesForDateAction(
  dateYmd: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmedDate = dateYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
    return { ok: false, error: "Data inválida." };
  }

  const supabase = await createServerSupabaseClient();
  const gate = await assertCanManageEscala(supabase);
  if (!gate.ok) return gate;

  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para esta operação.",
    };
  }

  const { error } = await admin
    .from("escalas")
    .delete()
    .eq("tipo", ESCALA_TIPO_PLANTAO)
    .eq("data_inicio", trimmedDate);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/escala");
  revalidatePath("/escala/plantoes");
  return { ok: true };
}

export async function deleteEscala(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = id?.trim();
  if (!trimmed) {
    return { ok: false, error: "ID inválido." };
  }

  const supabase = await createServerSupabaseClient();
  const gate = await assertCanManageEscala(supabase);
  if (!gate.ok) return gate;

  const { error } = await supabase.from("escalas").delete().eq("id", trimmed);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/escala");
  revalidatePath("/escala/plantoes");
  return { ok: true };
}

export async function saveEscalaAction(
  editingId: string | null | undefined,
  row: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient();
  const gate = await assertCanManageEscala(supabase);
  if (!gate.ok) return gate;

  const id = editingId?.trim();
  if (id) {
    const { error } = await supabase.from("escalas").update(row).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("escalas").insert(row);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/escala");
  revalidatePath("/escala/plantoes");
  return { ok: true };
}

function assertCanManageStreamyardUsuario(
  actor: {
    userId: string;
    email: string;
    funcao: string | null;
    isSuperAdmin: boolean;
    isEditor: boolean;
  },
  targetUsuarioId: string
): { ok: true } | { ok: false; error: string } {
  if (
    !canManageStreamyardEntry({
      currentUserId: actor.userId,
      currentUserEmail: actor.email,
      currentUserRole: actor.funcao,
      entryUsuarioId: targetUsuarioId,
    })
  ) {
    return { ok: false, error: STREAMYARD_ACCESS_DENIED };
  }
  return { ok: true };
}

export async function saveStreamyardAction(
  editingId: string | null | undefined,
  row: {
    usuario_id: string;
    data_inicio: string;
    horario: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getAdminActor();
  if (!actor.ok) return { ok: false, error: actor.error };

  const usuarioId = row.usuario_id?.trim() ?? "";
  const dataInicio = row.data_inicio?.trim() ?? "";
  const horarioNorm = normalizeStreamyardHorario(row.horario);

  if (!usuarioId) {
    return { ok: false, error: "Selecione um jornalista." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
    return { ok: false, error: "Data inválida." };
  }
  if (!horarioNorm) {
    return { ok: false, error: "Horário inválido." };
  }

  const perm = assertCanManageStreamyardUsuario(actor, usuarioId);
  if (!perm.ok) return perm;

  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para esta operação.",
    };
  }

  const id = editingId?.trim();
  if (id) {
    const { data: existing, error: fetchErr } = await admin
      .from("escalas")
      .select("id, tipo, usuario_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) return { ok: false, error: fetchErr.message };
    if (!existing || !isStreamyardTipo(existing.tipo)) {
      return { ok: false, error: "Marcação Streamyard não encontrada." };
    }

    const existingUid = existing.usuario_id?.trim() ?? "";
    const editPerm = assertCanManageStreamyardUsuario(actor, existingUid);
    if (!editPerm.ok) return editPerm;
  }

  let dupQuery = admin
    .from("escalas")
    .select("id")
    .eq("tipo", ESCALA_TIPO_STREAMYARD)
    .eq("data_inicio", dataInicio)
    .eq("usuario_id", usuarioId)
    .eq("horario", horarioNorm)
    .limit(1);

  if (id) {
    dupQuery = dupQuery.neq("id", id);
  }

  const { data: dupRows, error: dupErr } = await dupQuery;

  if (dupErr) return { ok: false, error: dupErr.message };
  if (dupRows && dupRows.length > 0) {
    return {
      ok: false,
      error: "Este jornalista já tem Streamyard neste horário neste dia.",
    };
  }

  const payload = {
    tipo: ESCALA_TIPO_STREAMYARD,
    usuario_id: usuarioId,
    data_inicio: dataInicio,
    data_fim: null,
    coordenador: null,
    horario: horarioNorm,
  };

  if (id) {
    const { error } = await admin.from("escalas").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin.from("escalas").insert(payload);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/escala");
  return { ok: true };
}

export async function deleteStreamyardAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = id?.trim();
  if (!trimmed) {
    return { ok: false, error: "ID inválido." };
  }

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

  const { data: existing, error: fetchErr } = await admin
    .from("escalas")
    .select("id, tipo, usuario_id")
    .eq("id", trimmed)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!existing || !isStreamyardTipo(existing.tipo)) {
    return { ok: false, error: "Marcação Streamyard não encontrada." };
  }

  const perm = assertCanManageStreamyardUsuario(
    actor,
    existing.usuario_id?.trim() ?? ""
  );
  if (!perm.ok) return perm;

  const { error } = await admin.from("escalas").delete().eq("id", trimmed);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/escala");
  return { ok: true };
}

/** Move uma marcação Streamyard para outro dia (arrastar no calendário). */
export async function moveStreamyardToDateAction(
  escalaId: string,
  targetDateYmd: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = escalaId?.trim();
  const target = targetDateYmd?.trim();
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(target)) {
    return { ok: false, error: "Dados inválidos." };
  }

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

  const { data: row, error: fetchErr } = await admin
    .from("escalas")
    .select("id, tipo, usuario_id, data_inicio, horario")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!row || !isStreamyardTipo(row.tipo)) {
    return { ok: false, error: "Marcação Streamyard não encontrada." };
  }

  const uid = row.usuario_id?.trim();
  const fromDate = row.data_inicio?.trim();
  const horario = row.horario?.trim();
  if (!uid || !fromDate || !horario) {
    return { ok: false, error: "Marcação inválida." };
  }

  const perm = assertCanManageStreamyardUsuario(actor, uid);
  if (!perm.ok) return perm;

  if (fromDate === target) {
    return { ok: true };
  }

  const { data: dupRows, error: dupErr } = await admin
    .from("escalas")
    .select("id")
    .eq("tipo", ESCALA_TIPO_STREAMYARD)
    .eq("data_inicio", target)
    .eq("usuario_id", uid)
    .eq("horario", horario)
    .neq("id", id)
    .limit(1);

  if (dupErr) return { ok: false, error: dupErr.message };
  if (dupRows && dupRows.length > 0) {
    return {
      ok: false,
      error: "Este jornalista já tem Streamyard neste horário neste dia.",
    };
  }

  const { error: updErr } = await admin
    .from("escalas")
    .update({ data_inicio: target })
    .eq("id", id);

  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/");
  revalidatePath("/escala");
  return { ok: true };
}
