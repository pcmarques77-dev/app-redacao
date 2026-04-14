"use client";

import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import { solicitarLinkAcesso } from "@/app/actions/auth";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setErro(null);
      const em = email.trim();
      if (!em) {
        setErro("Informe o e-mail.");
        return;
      }

      setEnviando(true);
      const res = await solicitarLinkAcesso(em);
      setEnviando(false);

      if (!res.ok) {
        setErro(res.error);
        return;
      }

      setSucesso(true);
    },
    [email]
  );

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-b from-slate-100 to-slate-200/90 px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-lg shadow-slate-200/50">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Acesso ao Painel
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Digite seu e-mail para receber o link seguro.
            </p>
          </div>

          {sucesso ? (
            <p
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-center text-sm text-emerald-800"
              role="status"
            >
              Link enviado! Verifique sua caixa de entrada
            </p>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <label
                  htmlFor="rec-email"
                  className="block text-sm font-medium text-slate-700"
                >
                  E-mail
                </label>
                <input
                  id="rec-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                  placeholder="nome@exemplo.com"
                />
              </div>

              {erro && (
                <p
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                  role="alert"
                >
                  {erro}
                </p>
              )}

              <button
                type="submit"
                disabled={enviando}
                className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {enviando ? "Enviando…" : "Enviar link"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-slate-600">
            <Link
              href="/login"
              className="font-medium text-blue-600 underline-offset-2 hover:text-blue-800 hover:underline"
            >
              Voltar para o login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
