"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { isEditorRole, isSuperAdminEmail } from "@/lib/admin-acl";
import { decemberThroughFirstWeekendNextYearYmds } from "@/lib/escala-planner-spill";
import { ESCALA_TIPO_PLANTAO } from "@/lib/escala-constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ESCALA_ACCESS_DENIED =
  "Acesso negado. Apenas editores podem gerenciar a escala.";

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

/**
 * Lista escalas para o painel. Usa service role no join com `usuarios`, pois no cliente
 * o embed `usuarios (nome)` fica vazio para outros IDs quando o RLS de `usuarios` é restritivo.
 */
export async function listEscalasForDashboardAction(): Promise<
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

  const { data, error } = await admin
    .from("escalas")
    .select(
      `
        id,
        tipo,
        usuario_id,
        data_inicio,
        data_fim,
        coordenador,
        horario,
        usuarios ( nome )
      `
    )
    .order("data_inicio", { ascending: true });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, rows: (data ?? []) as unknown as EscalaDashboardRow[] };
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

function monthBoundsYm(year: number, monthIndex: number): {
  monthStart: string;
  monthEnd: string;
} {
  const monthStart = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const monthEnd = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { monthStart, monthEnd };
}

function dateToYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Intervalo de `data_inicio` a carregar no planejador: inclui um dia extra quando o
 * fim de semana “atravessa” o limite do mês (ex.: sábado 31/10 + domingo 01/11).
 */
function plannerQueryRangeYm(year: number, monthIndex: number): {
  rangeStart: string;
  rangeEnd: string;
} {
  const { monthStart, monthEnd } = monthBoundsYm(year, monthIndex);
  let rangeStart = monthStart;
  let rangeEnd = monthEnd;

  const firstOfMonth = new Date(year, monthIndex, 1);
  if (firstOfMonth.getDay() === 0) {
    const prevSat = new Date(year, monthIndex, 0);
    if (prevSat.getDay() === 6) {
      rangeStart = dateToYmdLocal(prevSat);
    }
  }

  const lastOfMonth = new Date(year, monthIndex + 1, 0);
  if (lastOfMonth.getDay() === 6) {
    const nextSun = new Date(year, monthIndex + 1, 1);
    rangeEnd = dateToYmdLocal(nextSun);
  }

  if (monthIndex === 11) {
    const spill = decemberThroughFirstWeekendNextYearYmds(year);
    const spillEnd = spill[spill.length - 1];
    if (spillEnd && spillEnd > rangeEnd) rangeEnd = spillEnd;
  }

  return { rangeStart, rangeEnd };
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

  const sel = `
        id,
        tipo,
        usuario_id,
        data_inicio,
        data_fim,
        coordenador,
        horario,
        usuarios ( nome )
      `;

  const { rangeStart, rangeEnd } = plannerQueryRangeYm(year, monthIndex);

  const [{ data: inMonth, error: e1 }, { data: crossesIn, error: e2 }] =
    await Promise.all([
      admin
        .from("escalas")
        .select(sel)
        .gte("data_inicio", rangeStart)
        .lte("data_inicio", rangeEnd),
      admin
        .from("escalas")
        .select(sel)
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
  ingest(inMonth);
  ingest(crossesIn);

  const rows = [...map.values()].sort((a, b) =>
    (a.data_inicio ?? "").localeCompare(b.data_inicio ?? "")
  );

  return { ok: true, rows };
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
