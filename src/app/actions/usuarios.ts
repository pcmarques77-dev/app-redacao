"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { getAdminActor } from "@/app/actions/admin";

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

export type CriarNovoUsuarioResult = { success: boolean; error?: string };

export async function criarNovoUsuario(
  _prevState: unknown,
  formData: FormData
): Promise<CriarNovoUsuarioResult> {
  const actor = await getAdminActor();
  if (!actor.ok) {
    return { success: false, error: actor.error };
  }
  if (!actor.isSuperAdmin && !actor.isEditor) {
    return { success: false, error: "Acesso negado." };
  }

  const admin = getServiceClient();
  if (!admin) {
    return {
      success: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para criar usuários.",
    };
  }

  const nome = String(formData.get("nome") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  const cargo = String(formData.get("cargo") ?? "").trim();
  const senha = String(formData.get("senha") ?? "").trim();

  if (!nome) {
    return { success: false, error: "O nome é obrigatório." };
  }
  if (!emailRaw) {
    return { success: false, error: "O e-mail é obrigatório." };
  }
  if (!cargo) {
    return { success: false, error: "O cargo é obrigatório." };
  }
  if (!senha) {
    return { success: false, error: "A senha de acesso é obrigatória." };
  }
  if (senha.length < 6) {
    return {
      success: false,
      error: "A senha deve ter pelo menos 6 caracteres.",
    };
  }

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: emailRaw,
    password: senha,
    email_confirm: true,
    user_metadata: { nome, cargo },
  });

  if (authErr) {
    return { success: false, error: authErr.message };
  }
  if (!created.user?.id) {
    return {
      success: false,
      error: "A Auth não devolveu o ID do usuário criado.",
    };
  }

  const userId = created.user.id;

  /* Upsert: se existir trigger em auth.users que já insere em public.usuarios,
   * evitamos violação de chave única e alinhamos nome/e-mail/função. */
  const { error: profileErr } = await admin.from("usuarios").upsert(
    {
      id: userId,
      nome,
      email: emailRaw,
      funcao: cargo || null,
    },
    { onConflict: "id" }
  );

  if (profileErr) {
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      return {
        success: false,
        error: `${profileErr.message} (e o rollback na Auth falhou: ${delErr.message})`,
      };
    }
    return { success: false, error: profileErr.message };
  }

  revalidatePath("/admin");
  return { success: true };
}
