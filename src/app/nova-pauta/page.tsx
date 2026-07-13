"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { isEditorRole, isSuperAdminEmail } from "@/lib/admin-acl";
import {
  createPautaAction,
  getPautaSessionAction,
  listReportersForSessionAction,
} from "@/app/actions/pautas";
import { EDITORIA_OPTIONS, STATUS_OPTIONS } from "@/lib/pauta-form-options";
import type { PautaStatus } from "@/lib/pautas-shared";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Último dia útil (seg–sex) do mês corrente, apenas data (YYYY-MM-DD) para Postgres.
 */
function getLastBusinessDayOfMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const lastOfMonth = new Date(y, m + 1, 0);
  let day = lastOfMonth.getDate();
  const dow = lastOfMonth.getDay();
  if (dow === 6) day -= 1;
  else if (dow === 0) day -= 2;
  const d = new Date(y, m, day);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

type ReporterOption = {
  id: string;
  nome: string | null;
};

export default function NovaPautaPage() {
  const router = useRouter();

  const [reporters, setReporters] = useState<ReporterOption[]>([]);
  const [loadingReporters, setLoadingReporters] = useState(true);
  const [erroReporters, setErroReporters] = useState<string | null>(null);

  const [reporterId, setReporterId] = useState("");
  const [tituloProvisorio, setTituloProvisorio] = useState("");
  const [fontes, setFontes] = useState("");
  const [editoria, setEditoria] = useState("Últimas Notícias");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<PautaStatus>("Sugerida");
  const [salvandoPauta, setSalvandoPauta] = useState(false);
  const [erroFormPauta, setErroFormPauta] = useState<string | null>(null);

  const [sessionCtx, setSessionCtx] = useState<{
    userId: string;
    email: string;
    funcao: string | null;
  } | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const privilegedSession = useMemo(
    () =>
      sessionCtx
        ? isSuperAdminEmail(sessionCtx.email) ||
          isEditorRole(sessionCtx.funcao)
        : false,
    [sessionCtx]
  );

  useEffect(() => {
    void getPautaSessionAction().then((r) => {
      setSessionReady(true);
      if (r.ok) {
        setSessionCtx({
          userId: r.userId,
          email: r.email,
          funcao: r.funcao,
        });
        setSessionError(null);
      } else {
        setSessionCtx(null);
        setSessionError(r.error);
      }
    });
  }, []);

  useEffect(() => {
    if (!sessionCtx || privilegedSession) return;
    setReporterId(sessionCtx.userId);
  }, [sessionCtx, privilegedSession]);

  useEffect(() => {
    let cancelled = false;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url?.trim() || !key?.trim()) {
      setErroReporters(
        "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local."
      );
      setLoadingReporters(false);
      return;
    }

    void (async () => {
      const res = await listReportersForSessionAction();
      if (cancelled) return;
      setLoadingReporters(false);
      if (!res.ok) {
        setErroReporters(res.error);
        return;
      }
      setReporters((res.rows as ReporterOption[]) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCriarPauta = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setErroFormPauta(null);
      const titulo = tituloProvisorio.trim();
      if (!titulo) {
        setErroFormPauta("Informe o título provisório.");
        return;
      }
      if (privilegedSession && !reporterId.trim()) {
        setErroFormPauta("Selecione um repórter.");
        return;
      }
      if (!privilegedSession && !sessionCtx?.userId) {
        setErroFormPauta("Sessão inválida. Atualize a página e tente novamente.");
        return;
      }

      const deadlineOriginal = deadline.trim();
      const deadlineFinal = deadlineOriginal
        ? deadlineOriginal
        : getLastBusinessDayOfMonth();

      setSalvandoPauta(true);
      const insertRes = await createPautaAction({
        titulo_provisorio: titulo,
        fontes: fontes.trim() || null,
        arquivos_urls: [],
        editoria,
        deadline: deadlineFinal,
        status,
        demanda_multimidia: false,
        reporter_id: privilegedSession
          ? reporterId.trim()
          : sessionCtx!.userId,
      });

      setSalvandoPauta(false);

      if (!insertRes.ok) {
        setErroFormPauta(insertRes.error || "Não foi possível salvar a pauta.");
        return;
      }

      router.push("/");
    },
    [
      deadline,
      editoria,
      fontes,
      privilegedSession,
      reporterId,
      router,
      sessionCtx,
      status,
      tituloProvisorio,
    ]
  );

  const waitingInitial =
    !sessionReady || (privilegedSession && loadingReporters);

  return (
    <div className="min-h-screen bg-slate-100/80">
      <div className="mx-auto flex min-h-screen max-w-page flex-col px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            <span aria-hidden>←</span> Voltar
          </Link>
        </div>

        <div className="flex flex-1 flex-col justify-center pb-12">
          <header className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Nova pauta
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Preencha os dados para registrar uma nova pauta na redação.
            </p>
          </header>

          <section
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            aria-labelledby="nova-pauta-form-heading"
          >
            <h2 id="nova-pauta-form-heading" className="sr-only">
              Formulário de nova pauta
            </h2>

            {waitingInitial && (
              <p className="text-center text-sm text-slate-600" role="status">
                Carregando…
              </p>
            )}

            {sessionReady && sessionError && (
              <p className="text-center text-sm text-red-700" role="alert">
                {sessionError}
              </p>
            )}

            {sessionReady &&
              !sessionError &&
              !waitingInitial &&
              privilegedSession &&
              erroReporters && (
                <p className="text-center text-sm text-red-700" role="alert">
                  {erroReporters}
                </p>
              )}

            {sessionReady &&
              !sessionError &&
              !waitingInitial &&
              !(privilegedSession && erroReporters) && (
              <form className="space-y-4" onSubmit={handleCriarPauta}>
                {privilegedSession && reporters.length === 0 && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Nenhum repórter encontrado na tabela de usuários. Cadastre
                    usuários no Supabase para poder criar pautas.
                  </p>
                )}
                <div>
                  <label
                    htmlFor="titulo-provisorio"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Título provisório
                  </label>
                  <input
                    id="titulo-provisorio"
                    name="titulo_provisorio"
                    type="text"
                    value={tituloProvisorio}
                    onChange={(ev) => setTituloProvisorio(ev.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    placeholder="Ex.: Entrevista com o prefeito"
                  />
                </div>
                <div>
                  <label
                    htmlFor="editoria-pauta"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Editoria
                  </label>
                  <select
                    id="editoria-pauta"
                    name="editoria"
                    value={editoria}
                    onChange={(ev) => setEditoria(ev.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white py-2 pl-3 pr-[10px] text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  >
                    {EDITORIA_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                {privilegedSession ? (
                  <div>
                    <label
                      htmlFor="reporter-id"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Jornalista
                    </label>
                    <select
                      id="reporter-id"
                      name="reporter_id"
                      value={reporterId}
                      onChange={(ev) => setReporterId(ev.target.value)}
                      required
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white py-2 pl-3 pr-[10px] text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    >
                      <option value="">Selecione o jornalista</option>
                      {reporters.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nome?.trim() || "Sem nome"}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">
                    Esta pauta será atribuída a você como jornalista.
                  </p>
                )}
                <div>
                  <label
                    htmlFor="deadline-nova"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Prazo (deadline)
                  </label>
                  <input
                    id="deadline-nova"
                    name="deadline"
                    type="date"
                    value={deadline}
                    onChange={(ev) => setDeadline(ev.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Opcional. Se não informado, será usado o último dia útil do
                    mês atual.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="fontes-nova"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Fontes e links
                  </label>
                  <textarea
                    id="fontes-nova"
                    name="fontes"
                    value={fontes}
                    onChange={(ev) => setFontes(ev.target.value)}
                    rows={4}
                    placeholder="Fontes e links"
                    className="mt-1 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="status-pauta"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Status
                  </label>
                  <select
                    id="status-pauta"
                    name="status"
                    value={status}
                    onChange={(ev) => setStatus(ev.target.value as PautaStatus)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white py-2 pl-3 pr-[10px] text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  >
                    {STATUS_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {erroFormPauta && (
                  <p className="text-sm text-red-700" role="alert">
                    {erroFormPauta}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={
                      salvandoPauta ||
                      (privilegedSession &&
                        (reporters.length === 0 || !reporterId.trim())) ||
                      (!privilegedSession && !sessionCtx?.userId)
                    }
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {salvandoPauta ? "Salvando…" : "Salvar"}
                  </button>
                  <Link
                    href="/"
                    className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Cancelar
                  </Link>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
