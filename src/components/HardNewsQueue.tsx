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

function reporterLabel(nome: string | null | undefined): string {
  return (nome ?? "").trim() || "Sem nome";
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

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { reporterId: string | null; nome: string; items: HardNewsQueueRow[] }
    >();
    for (const row of rows) {
      const key = (row.reporter_id ?? "").trim() || "__none__";
      const nome = reporterLabel(row.reporter?.nome);
      const existing = map.get(key);
      if (existing) {
        existing.items.push(row);
      } else {
        map.set(key, {
          reporterId: row.reporter_id,
          nome,
          items: [row],
        });
      }
    }
    return [...map.values()].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR")
    );
  }, [rows]);

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

  async function onStatusChange(id: string, status: PautaStatus) {
    setBusyId(id);
    setErroLista(null);
    try {
      const res = await updateHardNewsAction(id, { status });
      if (!res.ok) {
        setErroLista(res.error);
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
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
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Fila de produção
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Hard news em produção agora — quem está produzindo cada reportagem.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 sm:p-5"
      >
        <h3 className="text-sm font-semibold text-slate-800">
          Nova reportagem
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_minmax(12rem,16rem)_auto] sm:items-end">
          <div>
            <label
              htmlFor="hard-news-titulo"
              className="block text-sm font-medium text-slate-700"
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
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          <div>
            <label
              htmlFor="hard-news-reporter"
              className="block text-sm font-medium text-slate-700"
            >
              Jornalista
            </label>
            <select
              id="hard-news-reporter"
              value={reporterId}
              onChange={(ev) => setReporterId(ev.target.value)}
              required
              className="mt-1 w-full rounded-md border border-slate-300 bg-white py-2 pl-3 pr-[10px] text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
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
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {salvando ? "Adicionando…" : "Adicionar"}
          </button>
        </div>
        {erroForm ? (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {erroForm}
          </p>
        ) : null}
      </form>

      {erroLista ? (
        <p className="text-sm text-red-700" role="alert">
          {erroLista}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-600" role="status">
          Carregando fila…
        </p>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-slate-600">
          Nenhuma hard news em produção no momento.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.reporterId ?? group.nome}>
              <h3 className="border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">
                {group.nome}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({group.items.length})
                </span>
              </h3>
              <ul className="mt-3 divide-y divide-slate-100">
                {group.items.map((item) => {
                  const busy = busyId === item.id;
                  const statusOk = PAUTA_STATUSES.includes(item.status)
                    ? item.status
                    : "Em produção";
                  return (
                    <li
                      key={item.id}
                      className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/pauta/${item.id}`}
                          className="font-medium text-slate-900 underline-offset-2 hover:text-blue-800 hover:underline"
                        >
                          {(item.titulo_provisorio ?? "").trim() || "Sem título"}
                        </Link>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="sr-only" htmlFor={`status-${item.id}`}>
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
                          className="rounded-md border border-slate-300 bg-white py-1.5 pl-2 pr-8 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-60"
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
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                        >
                          Remover
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
