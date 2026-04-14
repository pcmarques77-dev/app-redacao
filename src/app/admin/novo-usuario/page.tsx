"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { criarNovoUsuario } from "@/app/actions/usuarios";
import { isEditorRole, isSuperAdminEmail } from "@/lib/admin-acl";
import { createBrowserClient } from "@/lib/supabase/client";

function IconEyeOpen() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

export default function AdminNovoUsuarioPage() {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        router.replace("/admin");
        return;
      }
      const email = (user.email ?? "").trim().toLowerCase();
      if (isSuperAdminEmail(email)) return;

      const { data: row } = await supabase
        .from("usuarios")
        .select("funcao")
        .eq("id", user.id)
        .maybeSingle();
      const funcao = row?.funcao?.trim() ?? "";
      if (!isEditorRole(funcao)) {
        router.replace("/admin");
      }
    })();
  }, [router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);

    const formData = new FormData(e.currentTarget);
    const res = await criarNovoUsuario(null, formData);

    setSalvando(false);

    if (!res.success) {
      setErro(res.error ?? "Não foi possível criar o usuário.");
      return;
    }

    router.push("/admin?criado=1");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-100/80">
      <div className="mx-auto max-w-lg px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Criar usuário
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Voltar à lista
            </Link>
          </div>
        </header>

        {erro && (
          <div
            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm"
            role="alert"
          >
            {erro}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label
                htmlFor="nome"
                className="block text-sm font-medium text-slate-700"
              >
                Nome
              </label>
              <input
                id="nome"
                name="nome"
                type="text"
                required
                autoComplete="name"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700"
              >
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label
                htmlFor="cargo"
                className="block text-sm font-medium text-slate-700"
              >
                Cargo
              </label>
              <input
                id="cargo"
                name="cargo"
                type="text"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                placeholder="Ex.: Repórter, Editor…"
              />
            </div>
            <div>
              <label
                htmlFor="senha"
                className="block text-sm font-medium text-slate-700"
              >
                Senha de acesso
              </label>
              <div className="relative mt-1">
                <input
                  id="senha"
                  name="senha"
                  type={mostrarSenha ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-300 py-2 pl-3 pr-10 font-mono text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  aria-label={
                    mostrarSenha ? "Ocultar senha" : "Mostrar senha"
                  }
                  aria-pressed={mostrarSenha}
                >
                  {mostrarSenha ? <IconEyeOff /> : <IconEyeOpen />}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-medium text-blue-950">Primeiro acesso</p>
              <p className="mt-1 text-xs leading-relaxed text-blue-900/90 sm:text-sm">
                O usuário será criado com a senha definida acima. Informe esta
                senha ao usuário para que ele possa realizar o seu primeiro
                acesso.
              </p>
            </div>

            <button
              type="submit"
              disabled={salvando}
              className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salvando ? "Criando…" : "Criar usuário"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
