"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { createUsuariosRowAction } from "@/app/actions/admin";

export default function AdminNovoUsuarioPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [funcao, setFuncao] = useState("");
  const [dataCriacao, setDataCriacao] = useState("");
  const [criando, setCriando] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFeedback(null);
      setCriando(true);
      const res = await createUsuariosRowAction({
        nome,
        email,
        funcao,
        data_criacao: dataCriacao,
      });
      setCriando(false);
      if (!res.ok) {
        setFeedback({ type: "err", text: res.error });
        return;
      }
      router.push("/admin?criado=1");
      router.refresh();
    },
    [nome, email, funcao, dataCriacao, router]
  );

  return (
    <div className="min-h-screen bg-slate-100/80">
      <div className="mx-auto max-w-lg px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Criar usuário
            </h1>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              Novo registro em{" "}
              <code className="rounded bg-slate-200/80 px-1 text-xs">
                public.usuarios
              </code>
            </p>
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

        {feedback && (
          <div
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              feedback.type === "err"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
            role={feedback.type === "err" ? "alert" : "status"}
          >
            {feedback.text}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">Novo registro</h2>
          <p className="mt-1 text-xs text-slate-500">
            Gera um novo <code className="text-[11px]">id</code> (UUID). Deixe a
            data vazia para usar o padrão do banco, se houver.
          </p>
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="novo-nome"
                className="block text-sm font-medium text-slate-700"
              >
                Nome
              </label>
              <input
                id="novo-nome"
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              />
            </div>
            <div>
              <label
                htmlFor="novo-email"
                className="block text-sm font-medium text-slate-700"
              >
                E-mail
              </label>
              <input
                id="novo-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              />
            </div>
            <div>
              <label
                htmlFor="novo-funcao"
                className="block text-sm font-medium text-slate-700"
              >
                Função
              </label>
              <input
                id="novo-funcao"
                type="text"
                value={funcao}
                onChange={(e) => setFuncao(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              />
            </div>
            <div>
              <label
                htmlFor="novo-data"
                className="block text-sm font-medium text-slate-700"
              >
                Data de cadastro (opcional)
              </label>
              <input
                id="novo-data"
                type="datetime-local"
                value={dataCriacao}
                onChange={(e) => setDataCriacao(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              />
            </div>
            <button
              type="submit"
              disabled={criando}
              className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
            >
              {criando ? "Salvando…" : "Inserir na tabela"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
