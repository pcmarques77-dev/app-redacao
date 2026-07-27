"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  createHardNewsAction,
  deleteHardNewsAction,
  listHardNewsQueueAction,
  listReportersForSessionAction,
  updateHardNewsAction,
} from "@/app/actions/pautas";
import {
  createBrowserClient,
  ensureSupabaseAuthReady,
} from "@/lib/supabase/client";
import {
  PAUTA_STATUSES,
  type HardNewsQueueRow,
  type PautaStatus,
} from "@/lib/pautas-shared";

type ReporterOption = {
  id: string;
  nome: string | null;
};

const QUEUE_STATUS_OPTIONS: PautaStatus[] = [
  "Em produção",
  "Pronto",
  "Publicada",
];

/** Mesma paleta do calendário (âmbar / azul / verde). */
function normalizeStatusKey(s: string | null | undefined): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function statusBorderClass(status: PautaStatus): string {
  const n = normalizeStatusKey(status);
  if (n === "em producao") return "border-l-amber-400";
  if (n === "pronto") return "border-l-blue-400";
  if (n === "publicada") return "border-l-emerald-400";
  return "border-l-slate-300";
}

function statusSelectClass(status: PautaStatus): string {
  const n = normalizeStatusKey(status);
  const base =
    "w-full min-w-[8.5rem] max-w-[11rem] rounded border py-1 pl-1.5 pr-6 text-xs font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60";
  if (n === "em producao") {
    return `${base} border-amber-200 bg-amber-100 text-amber-900`;
  }
  if (n === "pronto") {
    return `${base} border-blue-200 bg-blue-100 text-blue-900`;
  }
  if (n === "publicada") {
    return `${base} border-emerald-200 bg-emerald-100 text-emerald-900`;
  }
  return `${base} border-slate-300 bg-white text-slate-700`;
}

function reporterLabel(nome: string | null | undefined): string {
  return (nome ?? "").trim() || "Sem nome";
}

function coerceQueueStatus(status: PautaStatus): PautaStatus {
  return PAUTA_STATUSES.includes(status) ? status : "Em produção";
}

export function HardNewsQueue() {
  const [rows, setRows] = useState<HardNewsQueueRow[]>([]);
  const [reporters, setReporters] = useState<ReporterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [reporterId, setReporterId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const [filtroReporter, setFiltroReporter] = useState("Todos");
  const [filtroStatus, setFiltroStatus] = useState("Todos");

  const refreshRef = useRef<() => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    const [queueRes, reportersRes] = await Promise.all([
      listHardNewsQueueAction(),
      listReportersForSessionAction(),
    ]);

    if (!queueRes.ok) {
      setErroLista(queueRes.error);
      setRows([]);
    } else {
      setErroLista(null);
      setRows(queueRes.rows);
    }

    if (reportersRes.ok) {
      setReporters(reportersRes.rows);
    }
  }, []);

  refreshRef.current = async () => {
    await load();
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    const client = createBrowserClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void refreshRef.current();
      }, 400);
    };
    const channel = client
      .channel("hard-news-queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pautas" },
        trigger
      );
    void ensureSupabaseAuthReady(client).then(() => {
      channel.subscribe();
    });
    return () => {
      if (timer) clearTimeout(timer);
      void client.removeChannel(channel);
    };
  }, []);

  const sortedRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (filtroReporter !== "Todos") {
        if ((row.reporter_id ?? "").trim() !== filtroReporter) return false;
      }
      if (filtroStatus !== "Todos") {
        if (row.status !== filtroStatus) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      const da = a.data_criacao ?? "";
      const db = b.data_criacao ?? "";
      return db.localeCompare(da);
    });
  }, [rows, filtroReporter, filtroStatus]);

  const idsVisiveis = useMemo(
    () => sortedRows.map((r) => r.id),
    [sortedRows]
  );

  const todosVisiveisSelecionados =
    idsVisiveis.length > 0 &&
    idsVisiveis.every((id) => selecionadas.includes(id));

  const algunsVisiveisSelecionados =
    idsVisiveis.some((id) => selecionadas.includes(id)) &&
    !todosVisiveisSelecionados;

  useEffect(() => {
    const el = selectAllRef.current;
    if (el) el.indeterminate = algunsVisiveisSelecionados;
  }, [algunsVisiveisSelecionados]);

  useEffect(() => {
    const visible = new Set(idsVisiveis);
    setSelecionadas((prev) => prev.filter((id) => visible.has(id)));
  }, [idsVisiveis]);

  function handleToggleLinha(id: string) {
    setSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleToggleSelectAll() {
    if (todosVisiveisSelecionados) {
      setSelecionadas((prev) => prev.filter((id) => !idsVisiveis.includes(id)));
      return;
    }
    setSelecionadas((prev) => [...new Set([...prev, ...idsVisiveis])]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErroForm(null);
    setSalvando(true);
    try {
      const res = await createHardNewsAction({
        titulo_provisorio: titulo,
        reporter_id: reporterId,
      });
      if (!res.ok) {
        setErroForm(res.error);
        return;
      }
      setTitulo("");
      setReporterId("");
      await load();
    } finally {
      setSalvando(false);
    }
  }

  async function applyStatusToIds(ids: string[], status: PautaStatus) {
    setErroLista(null);
    setBulkBusy(true);
    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          const res = await updateHardNewsAction(id, { status });
          return { id, res };
        })
      );
      const failed = results.filter((r) => !r.res.ok);
      if (failed.length > 0) {
        const first = failed[0]?.res;
        setErroLista(
          first && !first.ok
            ? first.error
            : "Não foi possível atualizar o status de alguns itens."
        );
      }
      await load();
    } finally {
      setBulkBusy(false);
      setBusyId(null);
    }
  }

  async function onStatusChange(id: string, status: PautaStatus) {
    const targets = selecionadas.includes(id) ? selecionadas : [id];
    setBusyId(id);
    await applyStatusToIds(targets, status);
  }

  async function onBulkStatusChange(status: PautaStatus) {
    if (selecionadas.length === 0) return;
    await applyStatusToIds(selecionadas, status);
  }

  async function onDelete(id: string) {
    if (!window.confirm("Remover este item da fila?")) return;
    setBusyId(id);
    setErroLista(null);
    try {
      const res = await deleteHardNewsAction(id);
      if (!res.ok) {
        setErroLista(res.error);
        return;
      }
      setSelecionadas((prev) => prev.filter((x) => x !== id));
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function onDeleteSelected() {
    if (selecionadas.length === 0) return;
    if (
      !window.confirm(
        `Remover ${selecionadas.length} item(ns) selecionado(s) da fila?`
      )
    ) {
      return;
    }
    setBulkBusy(true);
    setErroLista(null);
    try {
      const results = await Promise.all(
        selecionadas.map(async (id) => {
          const res = await deleteHardNewsAction(id);
          return { id, res };
        })
      );
      const failed = results.filter((r) => !r.res.ok);
      if (failed.length > 0) {
        const first = failed[0]?.res;
        setErroLista(
          first && !first.ok
            ? first.error
            : "Não foi possível remover alguns itens."
        );
      } else {
        setSelecionadas([]);
      }
      await load();
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Fila de produção
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Hard news em produção — quem está produzindo cada reportagem.
          </p>
        </div>
        <ul className="flex flex-wrap gap-3 text-xs text-slate-600">
          <li className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400"
              aria-hidden
            />
            Em produção
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-400"
              aria-hidden
            />
            Pronto
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400"
              aria-hidden
            />
            Publicada
          </li>
        </ul>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
          <form
            onSubmit={onSubmit}
            className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_minmax(9rem,13rem)_auto] sm:items-end"
          >
            <div>
              <label
                htmlFor="hard-news-titulo"
                className="block text-xs font-medium text-slate-700"
              >
                Título
              </label>
              <input
                id="hard-news-titulo"
                type="text"
                value={titulo}
                onChange={(ev) => setTitulo(ev.target.value)}
                required
                maxLength={255}
                placeholder="Ex.: Acidente na BR-101"
                suppressHydrationWarning
                className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>
            <div>
              <label
                htmlFor="hard-news-reporter"
                className="block text-xs font-medium text-slate-700"
              >
                Jornalista
              </label>
              <select
                id="hard-news-reporter"
                value={reporterId}
                onChange={(ev) => setReporterId(ev.target.value)}
                required
                suppressHydrationWarning
                className="mt-1 w-full rounded-md border border-slate-300 bg-white py-1.5 pl-2.5 pr-[10px] text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              >
                <option value="">Selecione</option>
                {reporters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {reporterLabel(r.nome)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={salvando}
              suppressHydrationWarning
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salvando ? "Adicionando…" : "Adicionar"}
            </button>
          </form>

          <div
            className="flex w-full shrink-0 flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-end lg:w-auto lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"
            role="search"
            aria-label="Filtros da fila"
          >
            <div>
              <label
                htmlFor="filtro-hard-news-reporter"
                className="block text-xs font-medium text-slate-700"
              >
                Filtrar jornalista
              </label>
              <select
                id="filtro-hard-news-reporter"
                value={filtroReporter}
                onChange={(e) => setFiltroReporter(e.target.value)}
                suppressHydrationWarning
                className="mt-1 w-full rounded-md border border-slate-300 bg-white py-1.5 pl-2.5 pr-[10px] text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 sm:w-48"
              >
                <option value="Todos">Todos os Jornalistas</option>
                {reporters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {reporterLabel(r.nome)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="filtro-hard-news-status"
                className="block text-xs font-medium text-slate-700"
              >
                Filtrar status
              </label>
              <select
                id="filtro-hard-news-status"
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                suppressHydrationWarning
                className="mt-1 w-full rounded-md border border-slate-300 bg-white py-1.5 pl-2.5 pr-[10px] text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 sm:w-44"
              >
                <option value="Todos">Todos os status</option>
                {QUEUE_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {erroForm ? (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {erroForm}
          </p>
        ) : null}
      </div>

      {erroLista ? (
        <p className="text-sm text-red-700" role="alert">
          {erroLista}
        </p>
      ) : null}

      {selecionadas.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2">
          <p className="text-sm font-medium text-slate-800">
            {selecionadas.length} selecionada
            {selecionadas.length === 1 ? "" : "s"}
          </p>
          <label className="sr-only" htmlFor="bulk-hard-news-status">
            Alterar status das selecionadas
          </label>
          <select
            id="bulk-hard-news-status"
            defaultValue=""
            disabled={bulkBusy}
            onChange={(ev) => {
              const next = ev.target.value as PautaStatus;
              if (!QUEUE_STATUS_OPTIONS.includes(next)) return;
              ev.target.value = "";
              void onBulkStatusChange(next);
            }}
            className="rounded border border-slate-300 bg-white py-1 pl-2 pr-7 text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60"
          >
            <option value="" disabled>
              Alterar status…
            </option>
            {QUEUE_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void onDeleteSelected()}
            className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Remover selecionadas
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => setSelecionadas([])}
            className="text-xs text-slate-600 underline-offset-2 hover:underline"
          >
            Limpar seleção
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-600" role="status">
          Carregando fila…
        </p>
      ) : sortedRows.length === 0 ? (
        <p className="text-sm text-slate-600">
          {rows.length === 0
            ? "Nenhuma hard news na fila no momento."
            : "Nenhuma hard news corresponde aos filtros selecionados."}
        </p>
      ) : (
        <>
          {/* Desktop / tablet: tabela compacta */}
          <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="w-10 whitespace-nowrap px-2 py-2">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={todosVisiveisSelecionados}
                        onChange={handleToggleSelectAll}
                        disabled={idsVisiveis.length === 0 || bulkBusy}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        aria-label="Selecionar todas as hard news visíveis"
                      />
                    </th>
                    <th
                      scope="col"
                      className="whitespace-nowrap px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Jornalista
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Título
                    </th>
                    <th
                      scope="col"
                      className="whitespace-nowrap px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Status
                    </th>
                    <th scope="col" className="w-20 px-2 py-2">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedRows.map((item) => {
                    const busy = busyId === item.id || bulkBusy;
                    const statusOk = coerceQueueStatus(item.status);
                    const checked = selecionadas.includes(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={`border-l-4 bg-white hover:bg-slate-50/80 ${statusBorderClass(statusOk)}`}
                      >
                        <td className="whitespace-nowrap px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleLinha(item.id)}
                            disabled={bulkBusy}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            aria-label={`Selecionar ${(item.titulo_provisorio ?? "").trim() || "sem título"}`}
                          />
                        </td>
                        <td className="max-w-[10rem] truncate whitespace-nowrap px-2 py-1.5 text-slate-700">
                          {reporterLabel(item.reporter?.nome)}
                        </td>
                        <td className="px-2 py-1.5 font-medium">
                          <Link
                            href={`/pauta/${item.id}`}
                            className="text-slate-900 underline-offset-2 hover:text-blue-800 hover:underline"
                          >
                            {(item.titulo_provisorio ?? "").trim() ||
                              "Sem título"}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5">
                          <label
                            className="sr-only"
                            htmlFor={`status-${item.id}`}
                          >
                            Status
                          </label>
                          <select
                            id={`status-${item.id}`}
                            value={statusOk}
                            disabled={busy}
                            onChange={(ev) => {
                              const next = ev.target.value as PautaStatus;
                              void onStatusChange(item.id, next);
                            }}
                            className={statusSelectClass(statusOk)}
                          >
                            {QUEUE_STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void onDelete(item.id)}
                            className="text-xs text-slate-600 underline-offset-2 hover:text-red-700 hover:underline disabled:opacity-60"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: lista densa */}
          <ul className="space-y-1.5 md:hidden" aria-label="Fila de hard news">
            <li className="flex items-center gap-2 px-1 py-1">
              <input
                type="checkbox"
                checked={todosVisiveisSelecionados}
                onChange={handleToggleSelectAll}
                disabled={idsVisiveis.length === 0 || bulkBusy}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                aria-label="Selecionar todas as hard news visíveis"
              />
              <span className="text-xs text-slate-600">Selecionar todas</span>
            </li>
            {sortedRows.map((item) => {
              const busy = busyId === item.id || bulkBusy;
              const statusOk = coerceQueueStatus(item.status);
              const checked = selecionadas.includes(item.id);
              return (
                <li
                  key={item.id}
                  className={`rounded border border-slate-200 border-l-4 bg-white px-2.5 py-2 ${statusBorderClass(statusOk)}`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleLinha(item.id)}
                      disabled={bulkBusy}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`Selecionar ${(item.titulo_provisorio ?? "").trim() || "sem título"}`}
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Link
                        href={`/pauta/${item.id}`}
                        className="block text-sm font-medium leading-snug text-slate-900 underline-offset-2 hover:text-blue-800 hover:underline"
                      >
                        {(item.titulo_provisorio ?? "").trim() || "Sem título"}
                      </Link>
                      <p className="text-xs text-slate-600">
                        {reporterLabel(item.reporter?.nome)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={statusOk}
                          disabled={busy}
                          onChange={(ev) => {
                            const next = ev.target.value as PautaStatus;
                            void onStatusChange(item.id, next);
                          }}
                          aria-label="Status"
                          className={statusSelectClass(statusOk)}
                        >
                          {QUEUE_STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onDelete(item.id)}
                          className="text-xs text-slate-600 underline-offset-2 hover:text-red-700 hover:underline disabled:opacity-60"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
