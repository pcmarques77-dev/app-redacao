"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  createBrowserClient,
  ensureSupabaseAuthReady,
} from "@/lib/supabase/client";
import { canUserEditOrDeletePauta } from "@/lib/admin-acl";
import {
  deletePautasAction,
  getPautaSessionAction,
  listReportersForSessionAction,
  updatePautaAction,
} from "@/app/actions/pautas";
import {
  PAUTA_ACCESS_DENIED,
  coercePautaStatus,
  type PautaStatus,
} from "@/lib/pautas-shared";
import { parseDeadlineToYmd } from "@/lib/deadline-date";
import { EDITORIA_OPTIONS, STATUS_OPTIONS } from "@/lib/pauta-form-options";

type ReporterOption = {
  id: string;
  nome: string | null;
};

export default function EditarPauta() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const [reporters, setReporters] = useState<ReporterOption[]>([]);
  const [tituloProvisorio, setTituloProvisorio] = useState("");
  const [fontes, setFontes] = useState("");
  const [editoria, setEditoria] = useState("Últimas Notícias");
  const [reporterId, setReporterId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<PautaStatus>("Sugerida");

  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const [sessionCtx, setSessionCtx] = useState<{
    userId: string;
    email: string;
    funcao: string | null;
  } | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [rowReporterId, setRowReporterId] = useState<string | null>(null);

  useEffect(() => {
    void getPautaSessionAction().then((r) => {
      setSessionReady(true);
      if (r.ok) {
        setSessionCtx({
          userId: r.userId,
          email: r.email,
          funcao: r.funcao,
        });
      } else {
        setSessionCtx(null);
      }
    });
  }, []);

  const canEditOrDelete = useMemo(() => {
    if (!sessionCtx) return false;
    return canUserEditOrDeletePauta({
      currentUserId: sessionCtx.userId,
      currentUserEmail: sessionCtx.email,
      currentUserRole: sessionCtx.funcao,
      pautaReporterId: rowReporterId,
    });
  }, [sessionCtx, rowReporterId]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setErroCarregamento(null);

      if (!id?.trim()) {
        setErroCarregamento("ID da pauta inválido.");
        setLoading(false);
        return;
      }

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url?.trim() || !key?.trim()) {
        setErroCarregamento(
          "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local."
        );
        setLoading(false);
        return;
      }

      const supabase = createBrowserClient();
      await ensureSupabaseAuthReady(supabase);

      const [repResult, pautaRes] = await Promise.all([
        listReportersForSessionAction(),
        supabase
          .from("pautas")
          .select(
            "titulo_provisorio, fontes, editoria, deadline, reporter_id, status"
          )
          .eq("id", id)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (!repResult.ok) {
        setErroCarregamento(repResult.error);
        setLoading(false);
        return;
      }

      if (pautaRes.error) {
        setErroCarregamento(pautaRes.error.message || "Não foi possível carregar a pauta.");
        setLoading(false);
        return;
      }

      if (!pautaRes.data) {
        setErroCarregamento("Pauta não encontrada.");
        setLoading(false);
        return;
      }

      const row = pautaRes.data as {
        titulo_provisorio: string | null;
        fontes: string | null;
        editoria: string | null;
        deadline: string | null;
        reporter_id: string | null;
        status: string | null;
      };

      setReporters((repResult.rows as ReporterOption[]) ?? []);
      setTituloProvisorio(row.titulo_provisorio?.trim() ?? "");
      setFontes(row.fontes?.trim() ?? "");
      setEditoria(row.editoria?.trim() || "Últimas Notícias");
      setReporterId(row.reporter_id?.trim() ?? "");
      setRowReporterId(row.reporter_id?.trim() ? row.reporter_id.trim() : null);
      setDeadline(parseDeadlineToYmd(row.deadline) ?? "");
      setStatus(coercePautaStatus(row.status));
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setErroForm(null);

      if (!id?.trim()) return;

      if (!sessionCtx) {
        setErroForm("Sessão inválida. Atualize a página e tente novamente.");
        return;
      }
      if (
        !canUserEditOrDeletePauta({
          currentUserId: sessionCtx.userId,
          currentUserEmail: sessionCtx.email,
          currentUserRole: sessionCtx.funcao,
          pautaReporterId: rowReporterId,
        })
      ) {
        setErroForm(PAUTA_ACCESS_DENIED);
        return;
      }

      const titulo = tituloProvisorio.trim();
      if (!titulo) {
        setErroForm("Informe o título provisório.");
        return;
      }
      if (!reporterId.trim()) {
        setErroForm("Selecione um repórter.");
        return;
      }

      const deadlineOriginal = deadline.trim();
      const anoAtual = new Date().getFullYear();
      const deadlineFinal = deadlineOriginal
        ? deadlineOriginal
        : `${anoAtual}-12-31`;

      setSalvando(true);
      const updateRes = await updatePautaAction(id, {
        titulo_provisorio: titulo,
        fontes: fontes.trim() || null,
        arquivos_urls: [],
        editoria,
        deadline: deadlineFinal,
        status,
        demanda_multimidia: false,
        reporter_id: reporterId.trim(),
      });

      setSalvando(false);

      if (!updateRes.ok) {
        setErroForm(
          updateRes.error === PAUTA_ACCESS_DENIED
            ? PAUTA_ACCESS_DENIED
            : updateRes.error || "Não foi possível salvar as alterações."
        );
        return;
      }

      router.push("/");
    },
    [
      deadline,
      editoria,
      fontes,
      id,
      reporterId,
      rowReporterId,
      router,
      sessionCtx,
      status,
      tituloProvisorio,
    ]
  );

  const handleExcluir = useCallback(async () => {
    if (!id?.trim()) return;
    if (
      !window.confirm(
        "Excluir esta pauta permanentemente? Esta ação não pode ser desfeita."
      )
    ) {
      return;
    }
    setErroForm(null);
    if (!sessionCtx) {
      setErroForm("Sessão inválida. Atualize a página e tente novamente.");
      return;
    }
    if (
      !canUserEditOrDeletePauta({
        currentUserId: sessionCtx.userId,
        currentUserEmail: sessionCtx.email,
        currentUserRole: sessionCtx.funcao,
        pautaReporterId: rowReporterId,
      })
    ) {
      setErroForm(PAUTA_ACCESS_DENIED);
      return;
    }
    setExcluindo(true);
    const delRes = await deletePautasAction([id]);
    setExcluindo(false);
    if (!delRes.ok) {
      setErroForm(
        delRes.error === PAUTA_ACCESS_DENIED
          ? PAUTA_ACCESS_DENIED
          : delRes.error || "Não foi possível excluir a pauta."
      );
      return;
    }
    router.push("/");
  }, [id, rowReporterId, router, sessionCtx]);

  const formularioPronto = !loading && !erroCarregamento;
  const editable = sessionReady && canEditOrDelete;

  return (
    <div className="min-h-screen bg-slate-100/80">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8 sm:px-6 lg:max-w-3xl lg:px-8">
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
              Apuração da pauta
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Fontes, referências e dados da pauta — salve para sincronizar com o
              painel.
            </p>
          </header>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {loading && (
              <p className="text-center text-sm text-slate-600" role="status">
                Carregando…
              </p>
            )}

            {!loading && erroCarregamento && (
              <p className="text-center text-sm text-red-700" role="alert">
                {erroCarregamento}
              </p>
            )}

            {formularioPronto && (
              <form className="space-y-4" onSubmit={handleSubmit}>
                {sessionReady && !canEditOrDelete && (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    Você pode consultar os dados desta pauta, mas não possui
                    permissão para alterá-la ou excluí-la.
                  </p>
                )}
                {reporters.length === 0 && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Nenhum repórter encontrado. Cadastre usuários no Supabase.
                  </p>
                )}
                <div>
                  <label
                    htmlFor="edit-titulo"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Título provisório
                  </label>
                  <input
                    id="edit-titulo"
                    name="titulo_provisorio"
                    type="text"
                    value={tituloProvisorio}
                    onChange={(ev) => setTituloProvisorio(ev.target.value)}
                    readOnly={!editable}
                    required
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 read-only:bg-slate-50 read-only:text-slate-700"
                    placeholder="Ex.: Entrevista com o prefeito"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-editoria"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Editoria
                  </label>
                  <select
                    id="edit-editoria"
                    name="editoria"
                    value={editoria}
                    onChange={(ev) => setEditoria(ev.target.value)}
                    disabled={!editable}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white py-2 pl-3 pr-[10px] text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    {EDITORIA_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="edit-reporter"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Jornalista
                  </label>
                  <select
                    id="edit-reporter"
                    name="reporter_id"
                    value={reporterId}
                    onChange={(ev) => setReporterId(ev.target.value)}
                    required
                    disabled={!editable || reporters.length === 0}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white py-2 pl-3 pr-[10px] text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    <option value="">Selecione o jornalista</option>
                    {reporters.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome?.trim() || "Sem nome"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="edit-deadline"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Prazo (deadline)
                  </label>
                  <input
                    id="edit-deadline"
                    name="deadline"
                    type="date"
                    value={deadline}
                    onChange={(ev) => setDeadline(ev.target.value)}
                    readOnly={!editable}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 read-only:bg-slate-50"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Opcional. Se vazio, será usado 31/12 do ano atual.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="edit-status"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Status
                  </label>
                  <select
                    id="edit-status"
                    name="status"
                    value={status}
                    onChange={(ev) => setStatus(ev.target.value as PautaStatus)}
                    disabled={!editable}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white py-2 pl-3 pr-[10px] text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    {STATUS_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="edit-fontes"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Fontes e links
                  </label>
                  <textarea
                    id="edit-fontes"
                    name="fontes"
                    value={fontes}
                    onChange={(ev) => setFontes(ev.target.value)}
                    readOnly={!editable}
                    rows={4}
                    placeholder="Fontes e links"
                    className="mt-1 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 read-only:bg-slate-50"
                  />
                </div>

                {erroForm && (
                  <p className="text-sm text-red-700" role="alert">
                    {erroForm}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 pt-2">
                  {canEditOrDelete ? (
                    <button
                      type="submit"
                      disabled={salvando || excluindo || reporters.length === 0}
                      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {salvando ? "Salvando…" : "Salvar"}
                    </button>
                  ) : null}
                  <Link
                    href="/"
                    className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Cancelar
                  </Link>
                </div>
                {canEditOrDelete ? (
                  <div className="mt-6 border-t border-slate-200 pt-4">
                    <button
                      type="button"
                      onClick={() => void handleExcluir()}
                      disabled={salvando || excluindo}
                      className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 shadow-sm transition-colors hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {excluindo ? "Excluindo…" : "Excluir pauta"}
                    </button>
                    <p className="mt-2 text-xs text-slate-500">
                      Remove o registro do painel. Não é possível desfazer.
                    </p>
                  </div>
                ) : null}
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
