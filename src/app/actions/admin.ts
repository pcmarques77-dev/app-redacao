"use server";

import { createClient } from "@supabase/supabase-js";
import { isEditorRole, isSuperAdminEmail } from "@/lib/admin-acl";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Linha de `public.usuarios` gerenciada na página Admin. */
export type UsuarioTableRow = {
  id: string;
  nome: string | null;
  email: string | null;
  funcao: string | null;
  data_criacao: string | null;
};

export type AdminActor =
  | {
      ok: true;
      userId: string;
      email: string;
      nome: string | null;
      funcao: string | null;
      isSuperAdmin: boolean;
      isEditor: boolean;
    }
  | { ok: false; error: string };

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

/** Sessão + função em `public.usuarios` (via service role, ignora RLS). */
export async function getAdminActor(): Promise<AdminActor> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { ok: false, error: "Sessão inválida. Faça login novamente." };
  }
  const email = (user.email ?? "").trim().toLowerCase();

  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para esta operação.",
    };
  }

  const { data: row, error } = await admin
    .from("usuarios")
    .select("funcao, nome")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  const funcaoRaw = row?.funcao?.trim() ?? null;
  const isSuperAdmin = isSuperAdminEmail(email);
  const isEditor = isEditorRole(funcaoRaw);

  return {
    ok: true,
    userId: user.id,
    email,
    nome: (row?.nome ?? "").trim() || null,
    funcao: funcaoRaw,
    isSuperAdmin,
    isEditor,
  };
}

export async function listUsuariosTableAction(): Promise<
  | { ok: true; rows: UsuarioTableRow[] }
  | { ok: false; error: string }
> {
  const actor = await getAdminActor();
  if (!actor.ok) return { ok: false, error: actor.error };

  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para gerenciar a tabela.",
    };
  }

  let q = admin
    .from("usuarios")
    .select("id, nome, email, funcao, data_criacao")
    .order("nome", { ascending: true });

  if (!actor.isSuperAdmin && !actor.isEditor) {
    q = q.eq("id", actor.userId);
  }

  const { data, error } = await q;

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, rows: (data ?? []) as UsuarioTableRow[] };
}

export async function createUsuariosRowAction(payload: {
  nome: string;
  email: string;
  funcao: string;
  data_criacao: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const actor = await getAdminActor();
  if (!actor.ok) return { ok: false, error: actor.error };
  if (!actor.isSuperAdmin && !actor.isEditor) {
    return { ok: false, error: "Acesso negado." };
  }

  const nome = payload.nome.trim();
  if (!nome) {
    return { ok: false, error: "O nome é obrigatório." };
  }

  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para criar registros.",
    };
  }

  const id = crypto.randomUUID();
  const email = payload.email.trim() || null;
  const funcao = payload.funcao.trim() || null;
  let data_criacao: string | null = null;
  if (payload.data_criacao.trim()) {
    const d = new Date(payload.data_criacao);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, error: "Data de cadastro inválida." };
    }
    data_criacao = d.toISOString();
  }

  const insertRow: Record<string, unknown> = {
    id,
    nome,
    email,
    funcao,
  };
  if (data_criacao) {
    insertRow.data_criacao = data_criacao;
  }

  const { error } = await admin.from("usuarios").insert(insertRow);
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, id };
}

export async function updateUsuariosRowAction(
  id: string,
  payload: {
    nome: string;
    email: string;
    funcao: string;
    data_criacao: string;
    senha?: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getAdminActor();
  if (!actor.ok) return { ok: false, error: actor.error };

  const nome = payload.nome.trim();
  if (!nome) {
    return { ok: false, error: "O nome é obrigatório." };
  }

  if (!actor.isSuperAdmin && id !== actor.userId) {
    return { ok: false, error: "Acesso negado." };
  }

  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para atualizar registros.",
    };
  }

  const senhaNova = payload.senha?.trim() ?? "";
  if (senhaNova) {
    if (senhaNova.length < 6) {
      return {
        ok: false,
        error: "A nova senha deve ter pelo menos 6 caracteres.",
      };
    }
    const { error: pwdErr } = await admin.auth.admin.updateUserById(id, {
      password: senhaNova,
    });
    if (pwdErr) {
      return { ok: false, error: pwdErr.message };
    }
  }

  if (actor.isSuperAdmin) {
    const email = payload.email.trim() || null;
    const funcao = payload.funcao.trim() || null;

    let data_criacao: string | null = null;
    if (payload.data_criacao.trim()) {
      const d = new Date(payload.data_criacao);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, error: "Data de cadastro inválida." };
      }
      data_criacao = d.toISOString();
    }

    const { error } = await admin
      .from("usuarios")
      .update({
        nome,
        email,
        funcao,
        data_criacao,
      })
      .eq("id", id);

    if (error) {
      return { ok: false, error: error.message };
    }
  } else {
    const { data: existing, error: fetchErr } = await admin
      .from("usuarios")
      .select("email, funcao, data_criacao")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) {
      return { ok: false, error: fetchErr.message };
    }
    if (!existing) {
      return { ok: false, error: "Registro não encontrado." };
    }

    const { error } = await admin
      .from("usuarios")
      .update({
        nome,
        email: existing.email,
        funcao: existing.funcao,
        data_criacao: existing.data_criacao,
      })
      .eq("id", id);

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  return { ok: true };
}

function authDeleteUserMissingInGoTrue(error: { message?: string }): boolean {
  const m = (error.message ?? "").toLowerCase();
  return (
    m.includes("not found") ||
    m.includes("does not exist") ||
    m.includes("user not found") ||
    m.includes("no user found")
  );
}

/** Remove a conta em Authentication (Admin API) e a linha em `public.usuarios`. */
export async function deleteUsuariosRowAction(
  rowId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getAdminActor();
  if (!actor.ok) return { ok: false, error: actor.error };

  if (!actor.isSuperAdmin) {
    return { ok: false, error: "Acesso negado." };
  }

  if (rowId === actor.userId) {
    return {
      ok: false,
      error: "Não é possível excluir o registro vinculado ao seu login.",
    };
  }

  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para excluir registros.",
    };
  }

  const { error: authDelErr } = await admin.auth.admin.deleteUser(rowId);
  if (authDelErr && !authDeleteUserMissingInGoTrue(authDelErr)) {
    return { ok: false, error: authDelErr.message };
  }

  const { error } = await admin.from("usuarios").delete().eq("id", rowId);
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
