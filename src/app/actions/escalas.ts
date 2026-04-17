"use server";

import { revalidatePath } from "next/cache";
import { isEditorRole, isSuperAdminEmail } from "@/lib/admin-acl";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ESCALA_ACCESS_DENIED =
  "Acesso negado. Apenas editores podem gerenciar a escala.";

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
