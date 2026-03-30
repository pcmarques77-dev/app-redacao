"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { STATUS_OPTIONS } from "@/lib/pauta-form-options";

export type SortColumn =
  | "reporter"
  | "titulo"
  | "editoria"
  | "prazo"
  | "status";
export type SortDirection = "asc" | "desc";

export type PautaRow = {
  id: string;
  titulo_provisorio: string | null;
  editoria: string | null;
  deadline: string | null;
  status: string | null;
  reporter: { nome: string | null } | null;
};

function reporterNome(p: PautaRow): string {
  return p.reporter?.nome?.trim() || "—";
}

function deadlineToDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeStatus(s: string | null): string {
  return (s ?? "").trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

function deadlineSortValue(p: PautaRow): number | null {
  if (!p.deadline) return null;
  const t = new Date(p.deadline).getTime();
  return Number.isNaN(t) ? null : t;
}

function compareText(a: string | null | undefined, b: string | null | undefined): number {
  const sa = (a ?? "").trim();
  const sb = (b ?? "").trim();
  return sa.localeCompare(sb, "pt-BR", { sensitivity: "base", numeric: true });
}

function comparePautas(
  a: PautaRow,
  b: PautaRow,
  column: SortColumn,
  dir: SortDirection
): number {
  const mult = dir === "asc" ? 1 : -1;

  switch (column) {
    case "reporter":
      return mult * compareText(reporterNome(a), reporterNome(b));
    case "titulo":
      return mult * compareText(a.titulo_provisorio, b.titulo_provisorio);
    case "editoria":
      return mult * compareText(a.editoria, b.editoria);
    case "status":
      return mult * compareText(a.status, b.status);
    case "prazo": {
      const ta = deadlineSortValue(a);
      const tb = deadlineSortValue(b);
      if (ta === null && tb === null) return 0;
      if (ta === null) return 1;
      if (tb === null) return -1;
      return mult * (ta - tb);
    }
    default:
      return 0;
  }
}

function SortColumnHeader({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
  thClassName = "",
}: {
  column: SortColumn;
  label: string;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (c: SortColumn) => void;
  thClassName?: string;
}) {
  const active = sortColumn === column;
  return (
    <th
      scope="col"
      aria-sort={
        active
          ? sortDirection === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      className={`px-4 py-2 sm:px-6 ${thClassName}`.trim()}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={
          active
            ? `Ordenado por ${label} (${sortDirection === "asc" ? "crescente" : "decrescente"}). Clique para inverter.`
            : `Ordenar por ${label}`
        }
        className="flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-0 py-1 text-left font-semibold text-slate-700 transition-colors hover:bg-slate-200/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {active && (
          <span
            className="shrink-0 text-base leading-none text-slate-500 tabular-nums"
            aria-hidden
          >
            {sortDirection === "asc" ? "↑" : "↓"}
          </span>
        )}
      </button>
    </th>
  );
}

function statusCalendarChipClass(status: string | null): string {
  const n = normalizeStatus(status);
  const base =
    "block w-full rounded border px-1.5 py-1 text-left text-[11px] font-medium leading-snug transition hover:ring-2 hover:ring-blue-400/40 focus-visible:outline focus-visible:ring-2 focus-visible:ring-blue-500";
  if (n === "aprovada") return `${base} border-emerald-300 bg-emerald-50 text-emerald-900`;
  if (n === "em apuracao") return `${base} border-amber-300 bg-amber-50 text-amber-900`;
  if (n === "finalizada") return `${base} border-slate-400 bg-slate-200 text-slate-900`;
  if (n === "sugerida") return `${base} border-sky-300 bg-sky-50 text-sky-900`;
  if (n === "redacao" || n === "revisao")
    return `${base} border-violet-300 bg-violet-50 text-violet-900`;
  if (n.includes("fact")) return `${base} border-orange-300 bg-orange-50 text-orange-900`;
  return `${base} border-slate-300 bg-slate-50 text-slate-800`;
}

function deadlineToYmdLocal(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Preserva hora/minuto/segundo do prazo anterior ao mudar só o dia (YYYY-MM-DD). */
function mergeDeadlineOntoYmd(previousIso: string | null, ymd: string): string {
  const parts = ymd.split("-").map((x) => parseInt(x, 10));
  const [ys, mo, ds] = parts;
  if (
    parts.length !== 3 ||
    Number.isNaN(ys) ||
    Number.isNaN(mo) ||
    Number.isNaN(ds)
  ) {
    return new Date().toISOString();
  }
  const base = previousIso ? new Date(previousIso) : null;
  if (base && !Number.isNaN(base.getTime())) {
    const nd = new Date(
      ys,
      mo - 1,
      ds,
      base.getHours(),
      base.getMinutes(),
      base.getSeconds(),
      base.getMilliseconds()
    );
    return nd.toISOString();
  }
  return new Date(ys, mo - 1, ds, 18, 0, 0, 0).toISOString();
}

function PautasCalendar({
  monthAnchor,
  onPrevMonth,
  onNextMonth,
  pautasPorDia,
  onDropDeadline,
}: {
  monthAnchor: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  pautasPorDia: Map<string, PautaRow[]>;
  onDropDeadline: (pautaId: string, targetDayYmd: string) => void | Promise<void>;
}) {
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const cells: { day: number | null; key: string | null }[] = [];
  for (let i = 0; i < startPad; i++) {
    cells.push({ day: null, key: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, key });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, key: null });
  }

  const tituloMes = monthAnchor.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const [dropHighlightKey, setDropHighlightKey] = useState<string | null>(null);

  const handleDragOverDay = useCallback(
    (e: DragEvent<HTMLDivElement>, dayKey: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropHighlightKey(dayKey);
    },
    []
  );

  const handleDragEnterDay = useCallback(
    (e: DragEvent<HTMLDivElement>, dayKey: string) => {
      e.preventDefault();
      setDropHighlightKey(dayKey);
    },
    []
  );

  const handleDragLeaveDay = useCallback(
    (e: DragEvent<HTMLDivElement>, dayKey: string) => {
      const cur = e.currentTarget;
      const rel = e.relatedTarget as Node | null;
      if (rel && cur.contains(rel)) return;
      setDropHighlightKey((k) => (k === dayKey ? null : k));
    },
    []
  );

  const handleDropOnDay = useCallback(
    (e: DragEvent<HTMLDivElement>, dayKey: string) => {
      e.preventDefault();
      setDropHighlightKey(null);
      const pautaId = e.dataTransfer.getData("pautaId");
      if (!pautaId?.trim()) return;
      void onDropDeadline(pautaId.trim(), dayKey);
    },
    [onDropDeadline]
  );

  const handleDragStartCard = useCallback((e: DragEvent<HTMLAnchorElement>) => {
    const id = e.currentTarget.dataset.pautaId;
    if (id) {
      e.dataTransfer.setData("pautaId", id);
      e.dataTransfer.effectAllowed = "move";
    }
  }, []);

  const handleDragEndCard = useCallback(() => {
    setDropHighlightKey(null);
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <button
          type="button"
          onClick={onPrevMonth}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ← Mês anterior
        </button>
        <h2 className="text-center text-lg font-semibold capitalize text-slate-900">
          {tituloMes}
        </h2>
        <button
          type="button"
          onClick={onNextMonth}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Próximo mês →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-px border-b border-slate-200 bg-slate-200">
        {weekLabels.map((w) => (
          <div
            key={w}
            className="bg-slate-100 px-1 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-200">
        {cells.map((cell, idx) => {
          const dayKey = cell.key;
          return (
          <div
            key={idx}
            className={`min-h-[7.5rem] p-1 transition-colors sm:min-h-[8.5rem] sm:p-1.5 ${
              cell.day === null
                ? "bg-slate-50/80"
                : dropHighlightKey === dayKey
                  ? "bg-blue-50/90 ring-2 ring-inset ring-blue-400/70"
                  : "bg-white"
            }`}
            onDragOver={
              dayKey
                ? (e) => handleDragOverDay(e, dayKey)
                : undefined
            }
            onDragEnter={
              dayKey
                ? (e) => handleDragEnterDay(e, dayKey)
                : undefined
            }
            onDragLeave={
              dayKey
                ? (e) => handleDragLeaveDay(e, dayKey)
                : undefined
            }
            onDrop={
              dayKey ? (e) => handleDropOnDay(e, dayKey) : undefined
            }
          >
            {cell.day !== null && dayKey !== null && (
              <>
                <div className="mb-1 text-right text-xs font-semibold tabular-nums text-slate-500">
                  {cell.day}
                </div>
                <ul className="max-h-[5.5rem] space-y-1 overflow-y-auto sm:max-h-[6.5rem]">
                  {(pautasPorDia.get(dayKey) ?? []).map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/pauta/${p.id}`}
                        data-pauta-id={p.id}
                        draggable
                        onDragStart={handleDragStartCard}
                        onDragEnd={handleDragEndCard}
                        className={`${statusCalendarChipClass(p.status)} cursor-grab active:cursor-grabbing`}
                      >
                        <span className="line-clamp-2">
                          {p.titulo_provisorio?.trim() || "Sem título"}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] font-normal opacity-80">
                          {p.editoria?.trim() || "—"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}

function statusSelectClassName(status: string | null): string {
  const n = normalizeStatus(status);
  const base =
    "w-full min-w-[9.5rem] max-w-full rounded-md border px-2 py-1.5 text-xs font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60 sm:max-w-[12rem]";
  if (n === "aprovada") return `${base} border-emerald-300 bg-emerald-50 text-emerald-900`;
  if (n === "em apuracao") return `${base} border-amber-300 bg-amber-50 text-amber-900`;
  if (n === "finalizada") return `${base} border-slate-400 bg-slate-200 text-slate-900`;
  if (n === "sugerida") return `${base} border-sky-300 bg-sky-50 text-sky-900`;
  if (n === "redacao" || n === "revisao")
    return `${base} border-violet-300 bg-violet-50 text-violet-900`;
  if (n.includes("fact")) return `${base} border-orange-300 bg-orange-50 text-orange-900`;
  return `${base} border-slate-300 bg-slate-50 text-slate-800`;
}

function DeadlineInlineInput({
  pautaId,
  deadline,
  saving,
  onChange,
}: {
  pautaId: string;
  deadline: string | null;
  saving: boolean;
  onChange: (pautaId: string, novaData: string) => void;
}) {
  return (
    <input
      type="datetime-local"
      value={deadlineToDatetimeLocalValue(deadline)}
      onChange={(e) => onChange(pautaId, e.target.value)}
      disabled={saving}
      aria-label="Editar prazo da pauta"
      className="max-w-[12rem] cursor-pointer rounded border-none bg-transparent p-0 text-sm text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
    />
  );
}

function StatusInlineSelect({
  pautaId,
  status,
  saving,
  onChange,
}: {
  pautaId: string;
  status: string | null;
  saving: boolean;
  onChange: (id: string, value: string) => void;
}) {
  const current = (status ?? "").trim() || "Sugerida";
  const inList = STATUS_OPTIONS.some((o) => o.value === current);
  return (
    <select
      aria-label="Alterar status da pauta"
      disabled={saving}
      value={current}
      onChange={(e) => onChange(pautaId, e.target.value)}
      className={statusSelectClassName(status)}
    >
      {!inList && (
        <option value={current}>
          {current}
        </option>
      )}
      {STATUS_OPTIONS.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

export function PautasDashboard() {
  const [pautas, setPautas] = useState<PautaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("prazo");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filtroReporter, setFiltroReporter] = useState("Todos");
  const [filtroEditoria, setFiltroEditoria] = useState("Todos");
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [deadlineSavingId, setDeadlineSavingId] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [feedbackErro, setFeedbackErro] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<"lista" | "calendario">("lista");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const opcoesReporters = useMemo(() => {
    const set = new Set<string>();
    for (const p of pautas) {
      const n = p.reporter?.nome?.trim();
      if (n) set.add(n);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [pautas]);

  const opcoesEditorias = useMemo(() => {
    const set = new Set<string>();
    for (const p of pautas) {
      const e = p.editoria?.trim();
      if (e) set.add(e);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [pautas]);

  const pautasFiltradas = useMemo(() => {
    return pautas.filter((p) => {
      if (filtroReporter !== "Todos") {
        const nome = reporterNome(p);
        if (nome === "—" || nome !== filtroReporter) return false;
      }
      if (filtroEditoria !== "Todos") {
        const ed = p.editoria?.trim() ?? "";
        if (!ed || ed !== filtroEditoria) return false;
      }
      return true;
    });
  }, [pautas, filtroReporter, filtroEditoria]);

  const sortedPautas = useMemo(() => {
    const rows = [...pautasFiltradas];
    rows.sort((a, b) => comparePautas(a, b, sortColumn, sortDirection));
    return rows;
  }, [pautasFiltradas, sortColumn, sortDirection]);

  const pautasPorDia = useMemo(() => {
    const m = new Map<string, PautaRow[]>();
    for (const p of pautasFiltradas) {
      const key = deadlineToYmdLocal(p.deadline);
      if (!key) continue;
      const arr = m.get(key) ?? [];
      arr.push(p);
      m.set(key, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) =>
        compareText(a.titulo_provisorio, b.titulo_provisorio)
      );
    }
    return m;
  }, [pautasFiltradas]);

  const idsVisiveis = useMemo(() => sortedPautas.map((p) => p.id), [sortedPautas]);

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    const n = idsVisiveis.length;
    if (n === 0) {
      el.indeterminate = false;
      return;
    }
    const marcados = idsVisiveis.filter((id) => selecionadas.includes(id)).length;
    el.indeterminate = marcados > 0 && marcados < n;
  }, [idsVisiveis, selecionadas]);

  useEffect(() => {
    setSelecionadas((prev) => prev.filter((id) => pautas.some((p) => p.id === id)));
  }, [pautas]);

  const handleSort = useCallback(
    (column: SortColumn) => {
      if (sortColumn === column) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortColumn(column);
        setSortDirection("asc");
      }
    },
    [sortColumn]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url?.trim() || !key?.trim()) {
      setError(
        "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local."
      );
      setPautas([]);
      setLoading(false);
      return;
    }
    const supabase = createBrowserClient();
    const { data, error: qErr } = await supabase
      .from("pautas")
      .select(
        `
        id,
        titulo_provisorio,
        editoria,
        deadline,
        status,
        reporter:usuarios!pautas_reporter_id_fkey(nome)
      `
      )
      .order("deadline", { ascending: true, nullsFirst: false });

    if (qErr) {
      setError(qErr.message || "Não foi possível carregar as pautas.");
      setPautas([]);
    } else {
      setPautas((data ?? []) as unknown as PautaRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const todosVisiveisSelecionados =
    idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionadas.includes(id));

  const handleToggleSelectAll = useCallback(() => {
    setSelecionadas((prev) => {
      if (idsVisiveis.length === 0) return prev;
      const allMarked = idsVisiveis.every((id) => prev.includes(id));
      if (allMarked) {
        return prev.filter((id) => !idsVisiveis.includes(id));
      }
      return [...new Set([...prev, ...idsVisiveis])];
    });
  }, [idsVisiveis]);

  const handleToggleLinha = useCallback((id: string) => {
    setSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleExcluirSelecionadas = useCallback(async () => {
    if (selecionadas.length === 0) return;
    if (
      !window.confirm(
        `Excluir ${selecionadas.length} pauta(s) selecionada(s)? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    setFeedbackErro(null);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url?.trim() || !key?.trim()) {
      setFeedbackErro("Configure as variáveis de ambiente do Supabase.");
      return;
    }
    setExcluindo(true);
    const supabase = createBrowserClient();
    const { error: delErr } = await supabase.from("pautas").delete().in("id", selecionadas);
    setExcluindo(false);
    if (delErr) {
      setFeedbackErro(delErr.message || "Não foi possível excluir as pautas.");
      return;
    }
    setSelecionadas([]);
    void load();
  }, [load, selecionadas]);

  const handleStatusChange = useCallback(
    async (id: string, newStatus: string) => {
      setFeedbackErro(null);
      let previous: string | null = null;
      setPautas((ps) =>
        ps.map((p) => {
          if (p.id === id) {
            previous = p.status;
            return { ...p, status: newStatus };
          }
          return p;
        })
      );
      setStatusSavingId(id);
      const supabase = createBrowserClient();
      const { error: upErr } = await supabase
        .from("pautas")
        .update({ status: newStatus })
        .eq("id", id);
      setStatusSavingId(null);
      if (upErr) {
        setPautas((ps) =>
          ps.map((p) => (p.id === id ? { ...p, status: previous } : p))
        );
        setFeedbackErro(upErr.message || "Não foi possível atualizar o status.");
      }
    },
    []
  );

  const handleDeadlineChange = useCallback(
    async (pautaId: string, novaData: string) => {
      if (!novaData.trim()) return;
      setFeedbackErro(null);
      const row = pautas.find((p) => p.id === pautaId);
      if (!row) return;

      const d = new Date(novaData);
      if (Number.isNaN(d.getTime())) return;
      const newIso = d.toISOString();

      const prevMs = row.deadline ? new Date(row.deadline).getTime() : NaN;
      const nextMs = new Date(newIso).getTime();
      if (!Number.isNaN(prevMs) && prevMs === nextMs) return;

      const previousDeadline = row.deadline;

      setPautas((ps) =>
        ps.map((p) => (p.id === pautaId ? { ...p, deadline: newIso } : p))
      );
      setDeadlineSavingId(pautaId);

      const supabase = createBrowserClient();
      const { error: upErr } = await supabase
        .from("pautas")
        .update({ deadline: newIso })
        .eq("id", pautaId);

      setDeadlineSavingId(null);

      if (upErr) {
        setPautas((ps) =>
          ps.map((p) =>
            p.id === pautaId ? { ...p, deadline: previousDeadline } : p
          )
        );
        setFeedbackErro(upErr.message || "Não foi possível atualizar o prazo.");
      }
    },
    [pautas]
  );

  const handleCalendarDeadlineDrop = useCallback(
    async (pautaId: string, targetYmd: string) => {
      setFeedbackErro(null);
      const row = pautas.find((p) => p.id === pautaId);
      if (!row) return;
      if (deadlineToYmdLocal(row.deadline) === targetYmd) return;

      const previousDeadline = row.deadline;
      const newIso = mergeDeadlineOntoYmd(row.deadline, targetYmd);

      setPautas((ps) =>
        ps.map((p) => (p.id === pautaId ? { ...p, deadline: newIso } : p))
      );

      const supabase = createBrowserClient();
      const { error: upErr } = await supabase
        .from("pautas")
        .update({ deadline: newIso })
        .eq("id", pautaId);

      if (upErr) {
        setPautas((ps) =>
          ps.map((p) =>
            p.id === pautaId ? { ...p, deadline: previousDeadline } : p
          )
        );
        setFeedbackErro(upErr.message || "Não foi possível atualizar o prazo.");
      }
    },
    [pautas]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Pautas Viva
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Acompanhe prazos e status das suas pautas.
          </p>
        </div>
        <Link
          href="/nova-pauta"
          className="inline-flex shrink-0 items-center justify-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Nova Pauta
        </Link>
      </header>

      {loading && (
        <div
          className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center text-slate-600 shadow-sm"
          role="status"
          aria-live="polite"
        >
          Carregando pautas...
        </div>
      )}

      {!loading && error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <p className="font-medium">Erro ao carregar</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-900 hover:bg-red-200"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && pautas.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-slate-500">
          Nenhuma pauta encontrada.
        </div>
      )}

      {!loading && !error && pautas.length > 0 && (
        <>
          {feedbackErro && (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              <p className="font-medium">Ação não concluída</p>
              <p className="mt-1">{feedbackErro}</p>
              <button
                type="button"
                onClick={() => setFeedbackErro(null)}
                className="mt-2 text-xs font-medium text-red-900 underline hover:no-underline"
              >
                Fechar
              </button>
            </div>
          )}

          <div
            className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            role="search"
            aria-label="Filtros e visualização"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
              <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:gap-6">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="filtro-reporter"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Filtrar por Repórter
                  </label>
                  <select
                    id="filtro-reporter"
                    value={filtroReporter}
                    onChange={(e) => setFiltroReporter(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="Todos">Todos os Repórteres</option>
                    {opcoesReporters.map((nome) => (
                      <option key={nome} value={nome}>
                        {nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="filtro-editoria"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Filtrar por Editoria
                  </label>
                  <select
                    id="filtro-editoria"
                    value={filtroEditoria}
                    onChange={(e) => setFiltroEditoria(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="Todos">Todas as Editorias</option>
                    {opcoesEditorias.map((ed) => (
                      <option key={ed} value={ed}>
                        {ed}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Visualização
                </span>
                <div
                  className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5 shadow-inner"
                  role="group"
                  aria-label="Alternar entre lista e calendário"
                >
                  <button
                    type="button"
                    onClick={() => setViewMode("lista")}
                    aria-pressed={viewMode === "lista"}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      viewMode === "lista"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <svg
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                      />
                    </svg>
                    Lista
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("calendario")}
                    aria-pressed={viewMode === "calendario"}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      viewMode === "calendario"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <svg
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5"
                      />
                    </svg>
                    Calendário
                  </button>
                </div>
              </div>
            </div>
          </div>

          {selecionadas.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleExcluirSelecionadas()}
                disabled={excluindo}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {excluindo ? "Excluindo…" : `Excluir Selecionadas (${selecionadas.length})`}
              </button>
            </div>
          )}

          {sortedPautas.length === 0 && (
            <div className="mb-6 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500">
              Nenhuma pauta corresponde aos filtros selecionados.
            </div>
          )}

          {sortedPautas.length > 0 && (
            <>
          {viewMode === "lista" && (
          <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th
                      scope="col"
                      className="w-12 whitespace-nowrap px-3 py-3 sm:px-4"
                    >
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={todosVisiveisSelecionados}
                        onChange={handleToggleSelectAll}
                        disabled={sortedPautas.length === 0}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        aria-label="Selecionar todas as pautas visíveis"
                      />
                    </th>
                    <SortColumnHeader
                      column="reporter"
                      label="Repórter"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      thClassName="whitespace-nowrap"
                    />
                    <SortColumnHeader
                      column="titulo"
                      label="Título provisório"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                    <SortColumnHeader
                      column="editoria"
                      label="Editoria"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      thClassName="min-w-[180px]"
                    />
                    <SortColumnHeader
                      column="prazo"
                      label="Prazo"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      thClassName="whitespace-nowrap"
                    />
                    <SortColumnHeader
                      column="status"
                      label="Status"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      thClassName="whitespace-nowrap"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedPautas.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80"
                    >
                      <td className="whitespace-nowrap px-3 py-4 sm:px-4">
                        <input
                          type="checkbox"
                          checked={selecionadas.includes(p.id)}
                          onChange={() => handleToggleLinha(p.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          aria-label={`Selecionar pauta ${p.titulo_provisorio?.trim() || "sem título"}`}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-700 sm:px-6">
                        {reporterNome(p)}
                      </td>
                      <td className="px-4 py-4 font-medium sm:px-6">
                        <Link
                          href={`/pauta/${p.id}`}
                          className="text-blue-600 underline-offset-2 hover:text-blue-800 hover:underline"
                        >
                          {p.titulo_provisorio?.trim() || "Sem título"}
                        </Link>
                      </td>
                      <td className="max-w-md px-4 py-4 text-slate-600 sm:px-6">
                        <span className="line-clamp-2">
                          {p.editoria?.trim() || "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-700 sm:px-6">
                        <DeadlineInlineInput
                          pautaId={p.id}
                          deadline={p.deadline}
                          saving={deadlineSavingId === p.id}
                          onChange={handleDeadlineChange}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                        <StatusInlineSelect
                          pautaId={p.id}
                          status={p.status}
                          saving={statusSavingId === p.id}
                          onChange={handleStatusChange}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ul className="space-y-4 md:hidden" aria-label="Lista de pautas">
            {sortedPautas.map((p) => (
              <li
                key={`card-${p.id}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-3 border-b border-slate-100 pb-3">
                  <input
                    type="checkbox"
                    checked={selecionadas.includes(p.id)}
                    onChange={() => handleToggleLinha(p.id)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    aria-label={`Selecionar pauta ${p.titulo_provisorio?.trim() || "sem título"}`}
                  />
                </div>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Repórter
                    </dt>
                    <dd className="mt-0.5 text-slate-900">
                      {reporterNome(p)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Título provisório
                    </dt>
                    <dd className="mt-0.5 font-semibold">
                      <Link
                        href={`/pauta/${p.id}`}
                        className="text-blue-600 underline-offset-2 hover:text-blue-800 hover:underline"
                      >
                        {p.titulo_provisorio?.trim() || "Sem título"}
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Editoria
                    </dt>
                    <dd className="mt-0.5 text-slate-600">
                      {p.editoria?.trim() || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Prazo
                    </dt>
                    <dd className="mt-0.5 text-slate-700">
                      <DeadlineInlineInput
                        pautaId={p.id}
                        deadline={p.deadline}
                        saving={deadlineSavingId === p.id}
                        onChange={handleDeadlineChange}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Status
                    </dt>
                    <dd className="mt-0.5 max-w-full">
                      <StatusInlineSelect
                        pautaId={p.id}
                        status={p.status}
                        saving={statusSavingId === p.id}
                        onChange={handleStatusChange}
                      />
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          </>
          )}

          {viewMode === "calendario" && (
            <PautasCalendar
              monthAnchor={calendarMonth}
              onPrevMonth={() =>
                setCalendarMonth(
                  (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)
                )
              }
              onNextMonth={() =>
                setCalendarMonth(
                  (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)
                )
              }
              pautasPorDia={pautasPorDia}
              onDropDeadline={handleCalendarDeadlineDrop}
            />
          )}
            </>
          )}
        </>
      )}
    </div>
  );
}
