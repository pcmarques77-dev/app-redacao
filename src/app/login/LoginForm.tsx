"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [erroCredencial, setErroCredencial] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setErro(null);
      setErroCredencial(false);
      const em = email.trim();
      if (!em) {
        setErro("Informe o e-mail.");
        return;
      }
      if (!password) {
        setErro("Informe a senha.");
        return;
      }

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url?.trim() || !key?.trim()) {
        setErro("Supabase não configurado (variáveis públicas ausentes).");
        return;
      }

      setCarregando(true);
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: em,
        password,
      });
      setCarregando(false);

      if (error) {
        const msg = error.message ?? "";
        if (
          msg.includes("Database error") ||
          msg.toLowerCase().includes("internal server error")
        ) {
          setErroCredencial(false);
          setErro(
            "O servidor de autenticação falhou ao carregar a conta (erro na base de dados). Isto costuma ser trigger ou hook em Auth a apontar para public.usuarios, ou políticas RLS. Consulte os logs em Supabase → Logs → Auth / Postgres."
          );
          return;
        }
        setErroCredencial(true);
        setErro("E-mail ou senha incorretos.");
        return;
      }

      try {
        await fetch("/api/auth/session-start", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        /* middleware inicia a janela de 23h no primeiro acesso protegido */
      }

      router.push(safeNextPath(searchParams.get("next")));
      router.refresh();
    },
    [email, password, router, searchParams]
  );

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-b from-slate-100 to-slate-200/90 px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-lg shadow-slate-200/50">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Pautas Viva
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Entre com seu e-mail e senha para acessar o painel.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-slate-700"
              >
                E-mail
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                placeholder="nome@exemplo.com"
                suppressHydrationWarning
              />
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-slate-700"
              >
                Senha
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                placeholder="••••••••"
                suppressHydrationWarning
              />
            </div>

            {erro && (
              <p
                className={
                  erroCredencial
                    ? "rounded-lg border border-red-100 bg-red-50/90 px-3 py-2 text-center text-sm text-red-600"
                    : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                }
                role="alert"
              >
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              suppressHydrationWarning
            >
              {carregando ? "Entrando…" : "Entrar"}
            </button>

            <div className="space-y-2 pt-1 text-center text-xs text-slate-500">
              <p>
                <Link
                  href="/esqueci-senha"
                  className="text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                >
                  Esqueceu sua senha? Clique aqui para redefinir
                </Link>
              </p>
              <p>
                <Link
                  href="/esqueci-senha"
                  className="text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                >
                  Primeiro acesso? Clique aqui para escolher uma nova senha
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
