"use server";

import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Linha de `public.usuarios` gerenciada na página Admin. */
export type UsuarioTableRow = {
  id: string;
  nome: string | null;
  email: string | null;
  funcao: string | null;
  data_criacao: string | null;
};

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

async function requireLoggedInUserId(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sessão inválida. Faça login novamente." };
  }
  return { ok: true, userId: user.id };
}

export async function listUsuariosTableAction(): Promise<
  | { ok: true; rows: UsuarioTableRow[] }
  | { ok: false; error: string }
> {
  const auth = await requireLoggedInUserId();
  if (!auth.ok) return { ok: false, error: auth.error };

  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para gerenciar a tabela.",
    };
  }

  const { data, error } = await admin
    .from("usuarios")
    .select("id, nome, email, funcao, data_criacao")
    .order("nome", { ascending: true });

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
  const auth = await requireLoggedInUserId();
  if (!auth.ok) return { ok: false, error: auth.error };

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
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireLoggedInUserId();
  if (!auth.ok) return { ok: false, error: auth.error };

  const nome = payload.nome.trim();
  if (!nome) {
    return { ok: false, error: "O nome é obrigatório." };
  }

  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para atualizar registros.",
    };
  }

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

  return { ok: true };
}

/** Remove apenas a linha em `public.usuarios` (não altera Authentication). */
export async function deleteUsuariosRowAction(
  rowId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireLoggedInUserId();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (rowId === auth.userId) {
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

  const { error } = await admin.from("usuarios").delete().eq("id", rowId);
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
