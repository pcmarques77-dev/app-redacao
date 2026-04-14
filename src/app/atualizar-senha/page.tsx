"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

function hashTemRecuperacao(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hash.includes("type=recovery");
}

/** PKCE no @supabase/ssr não lê o fragmento implicit; definimos a sessão explicitamente. */
async function estabelecerSessaoViaHashRecuperacao(
  supabase: SupabaseClient
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw || !raw.includes("type=recovery")) return false;

  const params = new URLSearchParams(raw);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return false;

  const { error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) return false;

  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}`);
  return true;
}

function mensagemErroAtualizarSenha(message: string | undefined): string {
  const msg = message ?? "Não foi possível atualizar a senha.";
  const lower = msg.toLowerCase();
  if (
    lower.includes("auth session missing") ||
    lower.includes("session missing") ||
    lower.includes("jwt expired")
  ) {
    return "Sessão expirada. Por favor, peça um novo link.";
  }
  return msg;
}

export default function AtualizarSenhaPage() {
  const router = useRouter();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [checandoSessao, setChecandoSessao] = useState(true);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient();
    let cancelled = false;

    const aplicarChecagem = (temSessao: boolean) => {
      if (cancelled) return;
      const temHashRecuperacao = hashTemRecuperacao();
      setMostrarFormulario(temSessao || temHashRecuperacao);
      setChecandoSessao(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "SIGNED_IN" && session) {
        /* Sessão recuperada a partir do link (implicit / setSession). */
        aplicarChecagem(true);
      }
      if (event === "INITIAL_SESSION" && session) {
        aplicarChecagem(true);
      }
    });

    void (async () => {
      await estabelecerSessaoViaHashRecuperacao(supabase);
      if (cancelled) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      aplicarChecagem(!!session);
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setErro(null);

      if (novaSenha !== confirmar) {
        setErro("As senhas não coincidem.");
        return;
      }
      if (novaSenha.length < 6) {
        setErro("A senha deve ter pelo menos 6 caracteres.");
        return;
      }

      setSalvando(true);
      const supabase = createBrowserClient();

      let {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        await estabelecerSessaoViaHashRecuperacao(supabase);
        ({
          data: { session },
        } = await supabase.auth.getSession());
      }

      if (!session) {
        setSalvando(false);
        setErro("Sessão expirada. Por favor, peça um novo link.");
        return;
      }

      const { error: upErr } = await supabase.auth.updateUser({
        password: novaSenha,
      });

      if (upErr) {
        setSalvando(false);
        setErro(mensagemErroAtualizarSenha(upErr.message));
        return;
      }

      setSalvando(false);
      void fetch("/api/auth/session-start", {
        method: "POST",
        credentials: "include",
      });
      router.push("/");
      router.refresh();
    },
    [confirmar, novaSenha, router]
  );

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-b from-slate-100 to-slate-200/90 px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-lg shadow-slate-200/50">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Criar Nova Senha
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Defina uma senha forte para o painel de pautas.
            </p>
          </div>

          {checandoSessao ? (
            <p className="text-center text-sm text-slate-600">
              Validando link…
            </p>
          ) : !mostrarFormulario ? (
            <p
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              role="alert"
            >
              Link inválido ou expirado. Solicite um novo link na página de
              recuperação de acesso.
            </p>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <label
                  htmlFor="nova-senha"
                  className="block text-sm font-medium text-slate-700"
                >
                  Nova senha
                </label>
                <input
                  id="nova-senha"
                  name="novaSenha"
                  type="password"
                  autoComplete="new-password"
                  value={novaSenha}
                  onChange={(ev) => setNovaSenha(ev.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label
                  htmlFor="confirmar-senha"
                  className="block text-sm font-medium text-slate-700"
                >
                  Confirmar senha
                </label>
                <input
                  id="confirmar-senha"
                  name="confirmarSenha"
                  type="password"
                  autoComplete="new-password"
                  value={confirmar}
                  onChange={(ev) => setConfirmar(ev.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                  placeholder="••••••••"
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
                disabled={salvando}
                className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvando ? "Salvando…" : "Salvar senha"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
