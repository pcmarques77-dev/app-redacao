"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { isEditorRole, isSuperAdminEmail } from "@/lib/admin-acl";
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
  return { ok: true };
}
