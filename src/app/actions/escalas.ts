"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function deleteEscala(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = id?.trim();
  if (!trimmed) {
    return { ok: false, error: "ID inválido." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sessão inválida. Faça login novamente." };
  }

  const { error } = await supabase.from("escalas").delete().eq("id", trimmed);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true };
}
