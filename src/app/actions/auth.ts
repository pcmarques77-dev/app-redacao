"use server";

import { createClient } from "@supabase/supabase-js";

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

/**
 * Verifica se o e-mail existe em `public.usuarios` e, em caso positivo,
 * envia o link de recuperação / primeiro acesso via Supabase Auth.
 */
export async function solicitarLinkAcesso(
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    return { ok: false, error: "Informe o e-mail." };
  }

  const service = getServiceClient();
  if (!service) {
    return {
      ok: false,
      error:
        "Serviço temporariamente indisponível. Avise a equipe técnica (chave de serviço não configurada).",
    };
  }

  const { data, error: qErr } = await service
    .from("usuarios")
    .select("id")
    .eq("email", trimmed)
    .limit(1)
    .maybeSingle();

  if (qErr) {
    return { ok: false, error: qErr.message };
  }

  if (!data) {
    return {
      ok: false,
      error: "E-mail não cadastrado. Procure a chefia da redação.",
    };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url.trim() || !anon.trim()) {
    return { ok: false, error: "Configuração do Supabase incompleta." };
  }

  const siteBase =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  const redirectTo = `${siteBase.replace(/\/$/, "")}/atualizar-senha`;

  const anonAuth = createClient(url, anon, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error: resetErr } = await anonAuth.auth.resetPasswordForEmail(
    trimmed,
    { redirectTo }
  );

  if (resetErr) {
    return { ok: false, error: resetErr.message };
  }

  return { ok: true };
}
