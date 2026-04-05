"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type MouseEvent,
} from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  deadlineYmdSortKey,
  formatDeadlinePtBR,
  parseDeadlineToYmd,
} from "@/lib/deadline-date";
import { EDITORIA_OPTIONS, STATUS_OPTIONS } from "@/lib/pauta-form-options";

type ModalReporterOption = {
  id: string;
  nome: string | null;
};

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

function normalizeStatus(s: string | null): string {
  return (s ?? "").trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

function deadlineSortValue(p: PautaRow): number | null {
  return deadlineYmdSortKey(p.deadline);
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

/** Domingo (00:00 local) da semana que contém `from`. */
function startOfWeekSunday(from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDaysLocal(from: Date, delta: number): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + delta);
  return d;
}

function dateToYmd(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatWeekRangeTitle(weekStart: Date): string {
  const end = addDaysLocal(weekStart, 6);
  const sameMonth =
    weekStart.getMonth() === end.getMonth() &&
    weekStart.getFullYear() === end.getFullYear();
  if (sameMonth) {
    const monthYear = weekStart.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
    return `${weekStart.getDate()}–${end.getDate()} de ${monthYear}`;
  }
  const a = weekStart.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const b = end.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${a} – ${b}`;
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

function PautasCalendar({
  scope,
  onScopeChange,
  monthAnchor,
  weekStart,
  onPrevMonth,
  onNextMonth,
  onPrevWeek,
  onNextWeek,
  pautasPorDia,
  onDropDeadline,
  onDayClick,
}: {
  scope: "month" | "week";
  onScopeChange: (s: "month" | "week") => void;
  monthAnchor: Date;
  weekStart: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  pautasPorDia: Map<string, PautaRow[]>;
  onDropDeadline: (pautaId: string, targetDayYmd: string) => void | Promise<void>;
  onDayClick?: (dayYmd: string) => void;
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

  const renderPautaList = (dayKey: string, listClassName: string) => (
    <ul className={listClassName}>
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
            <span className="mt-0.5 block truncate text-[10px] font-normal tabular-nums opacity-70">
              {formatDeadlinePtBR(parseDeadlineToYmd(p.deadline))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );

  const dayCellInteraction = (dayKey: string) => ({
    onClick: onDayClick
      ? (e: MouseEvent<HTMLDivElement>) => {
          const t = e.target as HTMLElement;
          if (t.closest("a[href]")) return;
          onDayClick(dayKey);
        }
      : undefined,
    onDragOver: (e: DragEvent<HTMLDivElement>) => handleDragOverDay(e, dayKey),
    onDragEnter: (e: DragEvent<HTMLDivElement>) => handleDragEnterDay(e, dayKey),
    onDragLeave: (e: DragEvent<HTMLDivElement>) => handleDragLeaveDay(e, dayKey),
    onDrop: (e: DragEvent<HTMLDivElement>) => handleDropOnDay(e, dayKey),
  });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <button
          type="button"
          onClick={scope === "month" ? onPrevMonth : onPrevWeek}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          {scope === "month" ? "← Mês anterior" : "← Semana anterior"}
        </button>
        <h2 className="text-center text-lg font-semibold capitalize text-slate-900">
          {scope === "month" ? tituloMes : formatWeekRangeTitle(weekStart)}
        </h2>
        <button
          type="button"
          onClick={scope === "month" ? onNextMonth : onNextWeek}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          {scope === "month" ? "Próximo mês →" : "Próxima semana →"}
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-slate-200 bg-slate-50/90 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Período
        </span>
        <div
          className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5 shadow-inner"
          role="group"
          aria-label="Alternar entre visão mensal e semanal"
        >
          <button
            type="button"
            onClick={() => onScopeChange("month")}
            aria-pressed={scope === "month"}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
              scope === "month"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Mês
          </button>
          <button
            type="button"
            onClick={() => onScopeChange("week")}
            aria-pressed={scope === "week"}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
              scope === "week"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Semana
          </button>
        </div>
      </div>

      {scope === "month" ? (
        <>
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
                  }${dayKey && onDayClick ? " cursor-pointer" : ""}`}
                  onClick={
                    dayKey && onDayClick
                      ? (e) => {
                          const t = e.target as HTMLElement;
                          if (t.closest("a[href]")) return;
                          onDayClick(dayKey);
                        }
                      : undefined
                  }
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
                      {renderPautaList(
                        dayKey,
                        "max-h-[5.5rem] space-y-1 overflow-y-auto sm:max-h-[6.5rem]"
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-px border-b border-slate-200 bg-slate-200">
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDaysLocal(weekStart, i);
              const ymd = dateToYmd(d);
              return (
                <div
                  key={ymd}
                  className="bg-slate-100 px-1 py-2 text-center text-slate-600"
                >
                  <div className="text-xs font-semibold uppercase tracking-wide">
                    {weekLabels[d.getDay()]}
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium capitalize tabular-nums text-slate-700 sm:text-xs">
                    {d.toLocaleDateString("pt-BR", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7 gap-px bg-slate-200">
            {Array.from({ length: 7 }, (_, i) => {
              const dayKey = dateToYmd(addDaysLocal(weekStart, i));
              const inter = dayCellInteraction(dayKey);
              return (
                <div
                  key={dayKey}
                  className={`min-h-[10rem] p-1.5 transition-colors sm:min-h-[12rem] sm:p-2 ${
                    dropHighlightKey === dayKey
                      ? "bg-blue-50/90 ring-2 ring-inset ring-blue-400/70"
                      : "bg-white"
                  }${onDayClick ? " cursor-pointer" : ""}`}
                  {...inter}
                >
                  {renderPautaList(
                    dayKey,
                    "max-h-[min(24rem,calc(100vh-18rem))] space-y-1 overflow-y-auto sm:max-h-[min(28rem,calc(100vh-16rem))]"
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
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
  const ymd = parseDeadlineToYmd(deadline);
  return (
    <input
      type="date"
      value={ymd ?? ""}
      onChange={(e) => onChange(pautaId, e.target.value)}
      disabled={saving}
      aria-label={`Editar prazo da pauta (${formatDeadlinePtBR(ymd)})`}
      className="max-w-[11rem] cursor-pointer rounded border-none bg-transparent p-0 text-sm text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
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
  const router = useRouter();
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
  const [viewMode, setViewMode] = useState<"lista" | "calendario">("calendario");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [calendarScope, setCalendarScope] = useState<"month" | "week">("month");
  const [calendarWeekStart, setCalendarWeekStart] = useState(() =>
    startOfWeekSunday(new Date())
  );

  const handleCalendarScopeChange = useCallback((s: "month" | "week") => {
    setCalendarScope(s);
    if (s === "week") {
      setCalendarWeekStart(startOfWeekSunday(new Date()));
    } else {
      const d = new Date();
      setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalTitulo, setModalTitulo] = useState("");
  const [modalResumo, setModalResumo] = useState("");
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalReporters, setModalReporters] = useState<ModalReporterOption[]>([]);
  const [modalReportersLoading, setModalReportersLoading] = useState(false);
  const [modalReportersError, setModalReportersError] = useState<string | null>(null);
  const [modalReporterId, setModalReporterId] = useState("");
  const [modalEditoria, setModalEditoria] = useState("Últimas Notícias");

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
      const key = parseDeadlineToYmd(p.deadline);
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

  useEffect(() => {
    if (!isModalOpen) return;
    let cancelled = false;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url?.trim() || !key?.trim()) {
      setModalReportersError(
        "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local."
      );
      setModalReportersLoading(false);
      return;
    }
    setModalReportersLoading(true);
    setModalReportersError(null);
    const supabase = createBrowserClient();
    void (async () => {
      const { data, error: qErr } = await supabase
        .from("usuarios")
        .select("id, nome")
        .order("nome", { ascending: true });
      if (cancelled) return;
      setModalReportersLoading(false);
      if (qErr) {
        setModalReportersError(qErr.message || "Não foi possível carregar os repórteres.");
        setModalReporters([]);
        return;
      }
      setModalReporters((data as ModalReporterOption[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [isModalOpen]);

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
      const ymd = novaData.trim();
      if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;
      setFeedbackErro(null);
      const row = pautas.find((p) => p.id === pautaId);
      if (!row) return;

      const prevYmd = parseDeadlineToYmd(row.deadline);
      if (prevYmd === ymd) return;

      const previousDeadline = row.deadline;

      setPautas((ps) =>
        ps.map((p) => (p.id === pautaId ? { ...p, deadline: ymd } : p))
      );
      setDeadlineSavingId(pautaId);

      const supabase = createBrowserClient();
      const { error: upErr } = await supabase
        .from("pautas")
        .update({ deadline: ymd })
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

  const handleLogout = useCallback(async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [router]);

  const handleCalendarDeadlineDrop = useCallback(
    async (pautaId: string, targetYmd: string) => {
      setFeedbackErro(null);
      const row = pautas.find((p) => p.id === pautaId);
      if (!row) return;
      if (parseDeadlineToYmd(row.deadline) === targetYmd) return;

      const previousDeadline = row.deadline;

      setPautas((ps) =>
        ps.map((p) => (p.id === pautaId ? { ...p, deadline: targetYmd } : p))
      );

      const supabase = createBrowserClient();
      const { error: upErr } = await supabase
        .from("pautas")
        .update({ deadline: targetYmd })
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

  const closeNovaPautaModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedDate(null);
    setModalTitulo("");
    setModalResumo("");
    setModalReporterId("");
    setModalEditoria("Últimas Notícias");
    setModalSaving(false);
    setModalError(null);
    setModalReportersError(null);
  }, []);

  const handleCalendarDayClick = useCallback((ymd: string) => {
    setSelectedDate(ymd);
    setModalTitulo("");
    setModalResumo("");
    setModalReporterId("");
    setModalEditoria("Últimas Notícias");
    setModalError(null);
    setModalReportersError(null);
    setIsModalOpen(true);
  }, []);

  const handleSubmitNovaPautaModal = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!selectedDate) return;
      const titulo = modalTitulo.trim();
      if (!titulo) {
        setModalError("Informe o título.");
        return;
      }
      if (!modalReporterId.trim()) {
        setModalError("Selecione um repórter.");
        return;
      }
      setModalError(null);
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url?.trim() || !key?.trim()) {
        setModalError("Configure as variáveis de ambiente do Supabase.");
        return;
      }
      setModalSaving(true);
      const supabase = createBrowserClient();
      const { error: insertErr } = await supabase.from("pautas").insert({
        titulo_provisorio: titulo,
        fontes: modalResumo.trim() || null,
        deadline: selectedDate,
        reporter_id: modalReporterId.trim(),
        editoria: modalEditoria,
        status: "Sugerida",
        arquivos_urls: [],
      });
      setModalSaving(false);
      if (insertErr) {
        setModalError(insertErr.message || "Não foi possível salvar a pauta.");
        return;
      }
      closeNovaPautaModal();
      void load();
    },
    [
      closeNovaPautaModal,
      load,
      modalEditoria,
      modalReporterId,
      modalResumo,
      modalTitulo,
      selectedDate,
    ]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/"
            className="inline-block cursor-pointer rounded-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 transition-colors hover:text-slate-700 sm:text-3xl">
              Pautas Viva
            </h1>
          </Link>
          <p className="mt-2 text-sm text-slate-600">
            Acompanhe prazos e status das suas pautas.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          <Link
            href="/radar-pautas"
            className="inline-flex items-center justify-center rounded-md border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-900 shadow-sm transition-colors hover:bg-teal-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
          >
            Radar de Pautas
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            Admin
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            aria-label="Sair da conta"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
            Sair
          </button>
          <Link
            href="/nova-pauta"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Nova Pauta
          </Link>
        </div>
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
                  aria-label="Alternar entre calendário e lista"
                >
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
              scope={calendarScope}
              onScopeChange={handleCalendarScopeChange}
              monthAnchor={calendarMonth}
              weekStart={calendarWeekStart}
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
              onPrevWeek={() =>
                setCalendarWeekStart((d) => addDaysLocal(d, -7))
              }
              onNextWeek={() =>
                setCalendarWeekStart((d) => addDaysLocal(d, 7))
              }
              pautasPorDia={pautasPorDia}
              onDropDeadline={handleCalendarDeadlineDrop}
              onDayClick={handleCalendarDayClick}
            />
          )}
            </>
          )}
        </>
      )}

      {isModalOpen && selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !modalSaving) closeNovaPautaModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="nova-pauta-modal-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2
                id="nova-pauta-modal-title"
                className="text-lg font-semibold text-slate-900"
              >
                Nova pauta
              </h2>
              <button
                type="button"
                onClick={() => !modalSaving && closeNovaPautaModal()}
                className="shrink-0 rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:opacity-50"
                aria-label="Fechar"
                disabled={modalSaving}
              >
                ×
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Prazo:{" "}
              <span className="font-medium text-slate-800">
                {formatDeadlinePtBR(selectedDate)}
              </span>
            </p>
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => void handleSubmitNovaPautaModal(e)}
            >
              {modalError && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {modalError}
                </p>
              )}
              <div>
                <label
                  htmlFor="modal-pauta-titulo"
                  className="block text-sm font-medium text-slate-700"
                >
                  Título
                </label>
                <input
                  id="modal-pauta-titulo"
                  type="text"
                  value={modalTitulo}
                  onChange={(e) => setModalTitulo(e.target.value)}
                  disabled={modalSaving}
                  autoFocus
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50 disabled:opacity-70"
                  placeholder="Título provisório"
                />
              </div>
              <div>
                <label
                  htmlFor="modal-pauta-resumo"
                  className="block text-sm font-medium text-slate-700"
                >
                  Resumo
                </label>
                <textarea
                  id="modal-pauta-resumo"
                  value={modalResumo}
                  onChange={(e) => setModalResumo(e.target.value)}
                  disabled={modalSaving}
                  rows={3}
                  className="mt-1 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50 disabled:opacity-70"
                  placeholder="Resumo ou notas rápidas"
                />
              </div>
              <div>
                <label
                  htmlFor="modal-pauta-reporter"
                  className="block text-sm font-medium text-slate-700"
                >
                  Repórter
                </label>
                {modalReportersLoading && (
                  <p className="mt-1 text-xs text-slate-500" role="status">
                    Carregando repórteres…
                  </p>
                )}
                {modalReportersError && !modalReportersLoading && (
                  <p className="mt-1 text-xs text-red-700">{modalReportersError}</p>
                )}
                <select
                  id="modal-pauta-reporter"
                  value={modalReporterId}
                  onChange={(e) => setModalReporterId(e.target.value)}
                  disabled={modalSaving || modalReportersLoading || modalReporters.length === 0}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70"
                >
                  <option value="">Selecione…</option>
                  {modalReporters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome?.trim() || "Sem nome"}
                    </option>
                  ))}
                </select>
                {!modalReportersLoading &&
                  !modalReportersError &&
                  modalReporters.length === 0 && (
                    <p className="mt-1 text-xs text-amber-800">
                      Nenhum usuário cadastrado. Use o Admin.
                    </p>
                  )}
              </div>
              <div>
                <label
                  htmlFor="modal-pauta-editoria"
                  className="block text-sm font-medium text-slate-700"
                >
                  Editoria
                </label>
                <select
                  id="modal-pauta-editoria"
                  value={modalEditoria}
                  onChange={(e) => setModalEditoria(e.target.value)}
                  disabled={modalSaving}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70"
                >
                  {EDITORIA_OPTIONS.map((ed) => (
                    <option key={ed} value={ed}>
                      {ed}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="modal-pauta-data"
                  className="block text-sm font-medium text-slate-700"
                >
                  Data (prazo)
                </label>
                <input
                  id="modal-pauta-data"
                  type="date"
                  value={selectedDate}
                  readOnly
                  disabled
                  aria-readonly="true"
                  className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => !modalSaving && closeNovaPautaModal()}
                  disabled={modalSaving}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
                >
                  {modalSaving ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
