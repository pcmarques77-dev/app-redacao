"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  canUserEditOrDeletePauta,
  isEditorRole,
  isSuperAdminEmail,
} from "@/lib/admin-acl";
import {
  createPautaAction,
  deletePautasAction,
  getPautaSessionAction,
  listPautasDashboardAction,
  updatePautaAction,
} from "@/app/actions/pautas";
import {
  PAUTA_ACCESS_DENIED,
  coercePautaStatus,
  type PautaStatus,
} from "@/lib/pautas-shared";
import {
  deadlineYmdSortKey,
  formatDeadlinePtBR,
  parseDeadlineToYmd,
} from "@/lib/deadline-date";
import { EDITORIA_OPTIONS, STATUS_OPTIONS } from "@/lib/pauta-form-options";
import {
  EscalaForm,
  type EscalaInitialValues,
} from "@/components/EscalaForm";

type ModalReporterOption = {
  id: string;
  nome: string | null;
};

type SortColumn =
  | "reporter"
  | "titulo"
  | "editoria"
  | "prazo"
  | "status";
type SortDirection = "asc" | "desc";

type PautaRow = {
  id: string;
  titulo_provisorio: string | null;
  editoria: string | null;
  deadline: string | null;
  status: PautaStatus;
  reporter_id: string | null;
  reporter: { nome: string | null } | null;
  demanda_multimidia: boolean;
};

type EscalaRow = {
  id: string;
  tipo: string | null;
  usuario_id: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  coordenador: string | null;
  horario: string | null;
  usuarios: { nome: string | null } | null;
};

function escalaUsuarioNome(e: EscalaRow): string {
  return e.usuarios?.nome?.trim() || "—";
}

function normalizeEscalaTipo(t: string | null): string {
  return (t ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function isPlantaoTipo(t: string | null): boolean {
  return normalizeEscalaTipo(t) === "plantao";
}

function isFeriasTipo(t: string | null): boolean {
  return normalizeEscalaTipo(t) === "ferias";
}

function isFeriadoTipo(t: string | null): boolean {
  const n = normalizeEscalaTipo(t);
  return n === "feriado" || n === "coordenacao";
}

function dayYmdInFeriasRange(
  dayYmd: string,
  start: string | null,
  end: string | null
): boolean {
  const a = start?.trim() ?? "";
  const b = end?.trim() ?? "";
  if (!a || !b) return false;
  return dayYmd >= a && dayYmd <= b;
}

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

/** Índice 0 = Segunda … 6 = Domingo (rótulos com semana começando na Segunda). */
function weekdayIndexMondayFirst(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Segunda-feira (00:00 local) da semana que contém `from` (semana seg–dom). */
function startOfWeekMonday(from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() - weekdayIndexMondayFirst(d));
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

/** Sobrevive a remontagem do painel após Server Actions / `router.refresh()`. */
const DASHBOARD_CAL_STORAGE_KEY = "pautas-dashboard-cal-v1";

type DashboardCalStored = {
  scope: "month" | "week";
  monthMs: number;
  weekStartMs: number;
  viewMode: "lista" | "calendario";
};

function parseDashboardCalStored(raw: string | null): DashboardCalStored | null {
  if (!raw?.trim()) return null;
  try {
    const p = JSON.parse(raw) as Partial<DashboardCalStored>;
    if (p.scope !== "month" && p.scope !== "week") return null;
    if (typeof p.monthMs !== "number" || typeof p.weekStartMs !== "number") {
      return null;
    }
    if (p.viewMode !== "lista" && p.viewMode !== "calendario") return null;
    if (Number.isNaN(new Date(p.monthMs).getTime())) return null;
    if (Number.isNaN(new Date(p.weekStartMs).getTime())) return null;
    return p as DashboardCalStored;
  } catch {
    return null;
  }
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

function statusCalendarChipClass(status: PautaStatus | null): string {
  const n = normalizeStatus(status);
  const base =
    "block w-full rounded border px-1.5 py-1 text-left text-[11px] font-medium leading-snug transition hover:ring-2 hover:ring-blue-400/40 focus-visible:outline focus-visible:ring-2 focus-visible:ring-blue-500";
  if (n === "sugerida") return `${base} border-slate-200 bg-slate-100 text-slate-700`;
  if (n === "em producao") return `${base} border-amber-200 bg-amber-100 text-amber-800`;
  if (n === "pronto") return `${base} border-emerald-200 bg-emerald-100 text-emerald-800`;
  if (n === "publicada") return `${base} border-blue-200 bg-blue-100 text-blue-800`;
  return `${base} border-slate-200 bg-slate-100 text-slate-700`;
}

function PautasCalendar({
  scope,
  monthAnchor,
  weekStart,
  onPrevMonth,
  onNextMonth,
  onPrevWeek,
  onNextWeek,
  pautasPorDia,
  escalas,
  onDropDeadline,
  controlsContent,
  onDayClick,
  onEscalaCardClick,
  onPautaChipClick,
  canManageDeadlineForPauta,
}: {
  scope: "month" | "week";
  monthAnchor: Date;
  weekStart: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  pautasPorDia: Map<string, PautaRow[]>;
  escalas: EscalaRow[];
  onDropDeadline: (pautaId: string, targetDayYmd: string) => void | Promise<void>;
  controlsContent?: ReactNode;
  onDayClick?: (dayYmd: string) => void;
  onEscalaCardClick?: (escala: EscalaRow, dayYmd: string) => void;
  onPautaChipClick?: (p: PautaRow) => void;
  canManageDeadlineForPauta?: (p: PautaRow) => boolean;
}) {
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();
  const first = new Date(year, month, 1);
  const startPad = weekdayIndexMondayFirst(first);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

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

  const handleDragStartCard = useCallback((e: DragEvent<HTMLButtonElement>) => {
    const id = e.currentTarget.dataset.pautaId;
    if (id) {
      e.dataTransfer.setData("pautaId", id);
      e.dataTransfer.effectAllowed = "move";
    }
  }, []);

  const handleDragEndCard = useCallback(() => {
    setDropHighlightKey(null);
  }, []);

  type CalendarioDiaItem =
    | { tipo: "feriado"; escala: EscalaRow }
    | { tipo: "plantao"; escala: EscalaRow }
    | { tipo: "pauta"; pauta: PautaRow }
    | { tipo: "ferias"; escala: EscalaRow };

  const CAL_EVENT_ORDER: Record<CalendarioDiaItem["tipo"], number> = {
    feriado: 1,
    plantao: 2,
    pauta: 3,
    ferias: 4,
  };

  const getCalendarioDiaItens = (dayKey: string): CalendarioDiaItem[] => {
    const items: CalendarioDiaItem[] = [];

    for (const e of escalas) {
      if (!isFeriadoTipo(e.tipo)) continue;
      const ini = e.data_inicio?.trim() ?? "";
      const fim = e.data_fim?.trim() || ini;
      if (dayYmdInFeriasRange(dayKey, ini, fim)) {
        items.push({ tipo: "feriado", escala: e });
      }
    }

    for (const e of escalas) {
      if (isPlantaoTipo(e.tipo) && e.data_inicio?.trim() === dayKey) {
        items.push({ tipo: "plantao", escala: e });
      }
    }

    for (const p of pautasPorDia.get(dayKey) ?? []) {
      items.push({ tipo: "pauta", pauta: p });
    }

    for (const e of escalas) {
      if (
        isFeriasTipo(e.tipo) &&
        dayYmdInFeriasRange(dayKey, e.data_inicio, e.data_fim)
      ) {
        items.push({ tipo: "ferias", escala: e });
      }
    }

    return items.sort(
      (a, b) => CAL_EVENT_ORDER[a.tipo] - CAL_EVENT_ORDER[b.tipo]
    );
  };

  const renderCalendarioDiaCards = (dayKey: string) => {
    const itens = getCalendarioDiaItens(dayKey);
    if (itens.length === 0) return null;
    return (
      <div className="mt-1 space-y-1">
        {itens.map((item) => {
          const key =
            item.tipo === "pauta"
              ? `pauta-${item.pauta.id}`
              : `${item.tipo}-${item.escala.id}`;

          if (item.tipo === "feriado") {
            const e = item.escala;
            const ini = e.data_inicio?.trim() ?? "";
            const fim = e.data_fim?.trim() || ini;
            const nomeFeriado = e.coordenador?.trim() || "Feriado";
            const periodoLabel =
              ini === fim
                ? formatDeadlinePtBR(ini)
                : `${formatDeadlinePtBR(ini)} – ${formatDeadlinePtBR(fim)}`;
            return (
              <button
                key={key}
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onEscalaCardClick?.(e, dayKey);
                }}
                className="block w-full cursor-pointer rounded border border-violet-400/70 bg-violet-100 px-1.5 py-1 text-left text-[10px] font-medium leading-snug text-violet-950 shadow-sm transition hover:ring-2 hover:ring-violet-400/50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <span className="line-clamp-2 font-semibold">
                  👑 {nomeFeriado}: {escalaUsuarioNome(e)}
                </span>
                {periodoLabel && (
                  <span className="mt-0.5 block truncate text-[9px] font-normal tabular-nums opacity-85">
                    {periodoLabel}
                  </span>
                )}
              </button>
            );
          }

          if (item.tipo === "plantao") {
            const e = item.escala;
            return (
              <button
                key={key}
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onEscalaCardClick?.(e, dayKey);
                }}
                className="block w-full cursor-pointer rounded border border-slate-700/35 bg-slate-800 px-1.5 py-1 text-left text-[10px] font-medium leading-snug text-amber-50 shadow-sm transition hover:ring-2 hover:ring-amber-400/40 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <span className="line-clamp-2 font-semibold">
                  Plantão: {escalaUsuarioNome(e)}
                </span>
                {e.horario?.trim() && (
                  <span className="mt-0.5 block truncate text-[9px] font-normal tabular-nums opacity-85">
                    {e.horario.trim()}
                  </span>
                )}
              </button>
            );
          }

          if (item.tipo === "ferias") {
            const e = item.escala;
            return (
              <button
                key={key}
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onEscalaCardClick?.(e, dayKey);
                }}
                className="block w-full cursor-pointer rounded border border-dashed border-emerald-600/45 bg-emerald-50/95 px-1.5 py-0.5 text-left text-[10px] leading-snug text-emerald-900 transition hover:bg-emerald-100/95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                ✈️ Férias: {escalaUsuarioNome(e)}
              </button>
            );
          }

          const p = item.pauta;
          const canDrag = canManageDeadlineForPauta?.(p) ?? false;
          return (
            <button
              key={key}
              type="button"
              data-pauta-calendario-chip
              data-pauta-id={p.id}
              draggable={canDrag}
              onDragStart={canDrag ? handleDragStartCard : undefined}
              onDragEnd={canDrag ? handleDragEndCard : undefined}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPautaChipClick?.(p);
              }}
              className={`${statusCalendarChipClass(p.status)} w-full text-left ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
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
            </button>
          );
        })}
      </div>
    );
  };

  /** @deprecated Use `renderCalendarioDiaCards`; kept for HMR/bundler caches that still reference the old name. */
  const renderPautaList = (dayKey: string, _listClassName?: string) =>
    renderCalendarioDiaCards(dayKey);

  const dayCellHandlers = (dayKey: string | null) => {
    if (!dayKey) {
      return {};
    }
    return {
      onClick: onDayClick
        ? (e: MouseEvent<HTMLDivElement>) => {
            const t = e.target as HTMLElement;
            if (t.closest("[data-pauta-calendario-chip]")) return;
            onDayClick(dayKey);
          }
        : undefined,
      onDragOver: (e: DragEvent<HTMLDivElement>) =>
        handleDragOverDay(e, dayKey),
      onDragEnter: (e: DragEvent<HTMLDivElement>) =>
        handleDragEnterDay(e, dayKey),
      onDragLeave: (e: DragEvent<HTMLDivElement>) =>
        handleDragLeaveDay(e, dayKey),
      onDrop: (e: DragEvent<HTMLDivElement>) => handleDropOnDay(e, dayKey),
    };
  };

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
      {controlsContent}
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
          <div className="grid grid-cols-7 items-stretch gap-px bg-slate-200">
            {cells.map((cell, idx) => {
              const dayKey = cell.key;
              return (
                <div
                  key={idx}
                  className={`h-auto min-h-[150px] p-1 transition-colors sm:min-h-[160px] sm:p-1.5 ${
                    cell.day === null
                      ? "bg-slate-50/80"
                      : dropHighlightKey === dayKey
                        ? "bg-blue-50/90 ring-2 ring-inset ring-blue-400/70"
                        : "bg-white"
                  }${dayKey && onDayClick ? " cursor-pointer" : ""}`}
                  {...dayCellHandlers(dayKey)}
                >
                  {cell.day !== null && dayKey !== null && (
                    <>
                      <div className="mb-1 text-right text-xs font-semibold tabular-nums text-slate-500">
                        {cell.day}
                      </div>
                      {renderCalendarioDiaCards(dayKey)}
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
                    {weekLabels[weekdayIndexMondayFirst(d)]}
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
          <div className="grid grid-cols-7 items-stretch gap-px bg-slate-200">
            {Array.from({ length: 7 }, (_, i) => {
              const dayKey = dateToYmd(addDaysLocal(weekStart, i));
              return (
                <div
                  key={dayKey}
                  className={`h-auto min-h-[150px] p-1.5 transition-colors sm:min-h-[12rem] sm:p-2 ${
                    dropHighlightKey === dayKey
                      ? "bg-blue-50/90 ring-2 ring-inset ring-blue-400/70"
                      : "bg-white"
                  }${onDayClick ? " cursor-pointer" : ""}`}
                  {...dayCellHandlers(dayKey)}
                >
                  {renderCalendarioDiaCards(dayKey)}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function statusSelectClassName(status: PautaStatus | null): string {
  const n = normalizeStatus(status);
  const base =
    "w-full min-w-[9.5rem] max-w-full rounded-md border px-2 py-1.5 text-xs font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60 sm:max-w-[12rem]";
  if (n === "sugerida") return `${base} border-slate-200 bg-slate-100 text-slate-700`;
  if (n === "em producao") return `${base} border-amber-200 bg-amber-100 text-amber-800`;
  if (n === "pronto") return `${base} border-emerald-200 bg-emerald-100 text-emerald-800`;
  if (n === "publicada") return `${base} border-blue-200 bg-blue-100 text-blue-800`;
  return `${base} border-slate-200 bg-slate-100 text-slate-700`;
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
  status: PautaStatus;
  saving: boolean;
  onChange: (id: string, value: PautaStatus) => void;
}) {
  const value = coercePautaStatus(status);
  return (
    <select
      aria-label="Alterar status da pauta"
      disabled={saving}
      value={value}
      onChange={(e) => onChange(pautaId, e.target.value as PautaStatus)}
      className={statusSelectClassName(status)}
    >
      {STATUS_OPTIONS.map(({ value: v, label }) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

export function PautasDashboard() {
  const router = useRouter();
  const [pautas, setPautas] = useState<PautaRow[]>([]);
  const [escalas, setEscalas] = useState<EscalaRow[]>([]);
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
  const [sessionCtx, setSessionCtx] = useState<{
    userId: string;
    email: string;
    nome: string | null;
    funcao: string | null;
  } | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<"lista" | "calendario">("calendario");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [calendarScope, setCalendarScope] = useState<"month" | "week">("month");
  const [calendarWeekStart, setCalendarWeekStart] = useState(() =>
    startOfWeekMonday(new Date())
  );

  const skipFirstCalPersistRef = useRef(true);

  useLayoutEffect(() => {
    const p = parseDashboardCalStored(
      sessionStorage.getItem(DASHBOARD_CAL_STORAGE_KEY)
    );
    if (!p) return;
    setCalendarScope(p.scope);
    setCalendarMonth(new Date(p.monthMs));
    setCalendarWeekStart(new Date(p.weekStartMs));
    setViewMode(p.viewMode);
  }, []);

  useEffect(() => {
    if (skipFirstCalPersistRef.current) {
      skipFirstCalPersistRef.current = false;
      return;
    }
    try {
      const payload: DashboardCalStored = {
        scope: calendarScope,
        monthMs: calendarMonth.getTime(),
        weekStartMs: calendarWeekStart.getTime(),
        viewMode,
      };
      sessionStorage.setItem(DASHBOARD_CAL_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [calendarScope, calendarMonth, calendarWeekStart, viewMode]);

  const handleCalendarScopeChange = useCallback((s: "month" | "week") => {
    setCalendarScope(s);
    if (s === "week") {
      setCalendarWeekStart(startOfWeekMonday(new Date()));
    } else {
      const ref = calendarWeekStart;
      setCalendarMonth(new Date(ref.getFullYear(), ref.getMonth(), 1));
    }
  }, [calendarWeekStart]);
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
  const [modalDemandaMultimidia, setModalDemandaMultimidia] = useState(false);
  const [pautaCalendarioSomenteLeitura, setPautaCalendarioSomenteLeitura] =
    useState<PautaRow | null>(null);
  const [modalTab, setModalTab] = useState<"pauta" | "escala">("pauta");
  const [escalaFormDirty, setEscalaFormDirty] = useState(false);
  const [escalaSaving, setEscalaSaving] = useState(false);
  const [editingEscala, setEditingEscala] = useState<EscalaRow | null>(null);

  const escalaFormInitial = useMemo((): EscalaInitialValues | undefined => {
    if (!editingEscala?.usuario_id?.trim()) return undefined;
    return {
      id: editingEscala.id,
      tipo: editingEscala.tipo,
      usuario_id: editingEscala.usuario_id.trim(),
      data_inicio: editingEscala.data_inicio,
      data_fim: editingEscala.data_fim,
      coordenador: editingEscala.coordenador,
      horario: editingEscala.horario,
    };
  }, [editingEscala]);

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

  const canManagePauta = useCallback(
    (p: PautaRow) => {
      if (!sessionCtx) return false;
      return canUserEditOrDeletePauta({
        currentUserId: sessionCtx.userId,
        currentUserEmail: sessionCtx.email,
        currentUserRole: sessionCtx.funcao,
        pautaReporterId: p.reporter_id,
      });
    },
    [sessionCtx]
  );

  const handleCalendarioPautaChipClick = useCallback(
    (p: PautaRow) => {
      if (!sessionCtx || canManagePauta(p)) {
        router.push(`/pauta/${p.id}`);
      } else {
        setPautaCalendarioSomenteLeitura(p);
      }
    },
    [canManagePauta, router, sessionCtx]
  );

  const privilegedSession = useMemo(
    () =>
      sessionCtx
        ? isSuperAdminEmail(sessionCtx.email) ||
          isEditorRole(sessionCtx.funcao)
        : false,
    [sessionCtx]
  );

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

  const idsVisiveisGerenciaveis = useMemo(
    () => sortedPautas.filter((p) => canManagePauta(p)).map((p) => p.id),
    [sortedPautas, canManagePauta]
  );

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    const n = idsVisiveisGerenciaveis.length;
    if (n === 0) {
      el.indeterminate = false;
      return;
    }
    const marcados = idsVisiveisGerenciaveis.filter((id) =>
      selecionadas.includes(id)
    ).length;
    el.indeterminate = marcados > 0 && marcados < n;
  }, [idsVisiveisGerenciaveis, selecionadas]);

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

  const fetchDashboardData = useCallback(async (): Promise<
    | { ok: true; pautas: PautaRow[]; escalas: EscalaRow[] }
    | { ok: false; error: string }
  > => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url?.trim() || !key?.trim()) {
      return {
        ok: false,
        error:
          "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local.",
      };
    }
    const supabase = createBrowserClient();
    const [pautaResult, eRes] = await Promise.all([
      listPautasDashboardAction(),
      supabase
        .from("escalas")
        .select(
          `
        id,
        tipo,
        usuario_id,
        data_inicio,
        data_fim,
        coordenador,
        horario,
        usuarios ( nome )
      `
        )
        .order("data_inicio", { ascending: true }),
    ]);

    if (!pautaResult.ok) {
      return {
        ok: false,
        error: pautaResult.error || "Não foi possível carregar as pautas.",
      };
    }
    const escalas: EscalaRow[] = eRes.error
      ? []
      : ((eRes.data ?? []) as unknown as EscalaRow[]);
    return {
      ok: true,
      pautas: pautaResult.rows as PautaRow[],
      escalas,
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchDashboardData();
    if (!res.ok) {
      setError(res.error);
      setPautas([]);
      setEscalas([]);
    } else {
      setPautas(res.pautas);
      setEscalas(res.escalas);
    }
    setLoading(false);
  }, [fetchDashboardData]);

  /** Atualiza pautas/escalas sem `loading` global — preserva Mês/Semana e demais estado de UI. */
  const refreshDashboardData = useCallback(async () => {
    const res = await fetchDashboardData();
    if (!res.ok) {
      setFeedbackErro(
        res.error ||
          "Não foi possível atualizar os dados. Tente recarregar a página."
      );
      return;
    }
    setPautas(res.pautas);
    setEscalas(res.escalas);
  }, [fetchDashboardData]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void getPautaSessionAction().then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setSessionCtx({
          userId: r.userId,
          email: r.email,
          nome: r.nome,
          funcao: r.funcao,
        });
      } else {
        setSessionCtx(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isModalOpen || !sessionCtx || privilegedSession) return;
    setModalReporterId(sessionCtx.userId);
  }, [isModalOpen, sessionCtx, privilegedSession]);

  useEffect(() => {
    if (privilegedSession || !isModalOpen) return;
    if (modalTab === "escala") setModalTab("pauta");
  }, [privilegedSession, isModalOpen, modalTab]);

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
    idsVisiveisGerenciaveis.length > 0 &&
    idsVisiveisGerenciaveis.every((id) => selecionadas.includes(id));

  const handleToggleSelectAll = useCallback(() => {
    setSelecionadas((prev) => {
      if (idsVisiveisGerenciaveis.length === 0) return prev;
      const allMarked = idsVisiveisGerenciaveis.every((id) => prev.includes(id));
      if (allMarked) {
        return prev.filter((id) => !idsVisiveisGerenciaveis.includes(id));
      }
      return [...new Set([...prev, ...idsVisiveisGerenciaveis])];
    });
  }, [idsVisiveisGerenciaveis]);

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
    setExcluindo(true);
    const delRes = await deletePautasAction(selecionadas);
    setExcluindo(false);
    if (!delRes.ok) {
      setFeedbackErro(delRes.error || "Não foi possível excluir as pautas.");
      return;
    }
    setSelecionadas([]);
    void refreshDashboardData();
  }, [refreshDashboardData, selecionadas]);

  const handleStatusChange = useCallback(
    async (id: string, newStatus: PautaStatus) => {
      setFeedbackErro(null);
      let previous: PautaStatus = "Sugerida";
      setPautas((ps) => {
        const hit = ps.find((p) => p.id === id);
        if (hit) previous = hit.status;
        return ps.map((p) => (p.id === id ? { ...p, status: newStatus } : p));
      });
      setStatusSavingId(id);
      const upRes = await updatePautaAction(id, { status: newStatus });
      setStatusSavingId(null);
      if (!upRes.ok) {
        setPautas((ps) =>
          ps.map((p) => (p.id === id ? { ...p, status: previous } : p))
        );
        setFeedbackErro(
          upRes.error === PAUTA_ACCESS_DENIED
            ? PAUTA_ACCESS_DENIED
            : upRes.error || "Não foi possível atualizar o status."
        );
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

      const upRes = await updatePautaAction(pautaId, { deadline: ymd });

      setDeadlineSavingId(null);

      if (!upRes.ok) {
        setPautas((ps) =>
          ps.map((p) =>
            p.id === pautaId ? { ...p, deadline: previousDeadline } : p
          )
        );
        setFeedbackErro(
          upRes.error === PAUTA_ACCESS_DENIED
            ? PAUTA_ACCESS_DENIED
            : upRes.error || "Não foi possível atualizar o prazo."
        );
      }
    },
    [pautas]
  );

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

      const upRes = await updatePautaAction(pautaId, { deadline: targetYmd });

      if (!upRes.ok) {
        setPautas((ps) =>
          ps.map((p) =>
            p.id === pautaId ? { ...p, deadline: previousDeadline } : p
          )
        );
        setFeedbackErro(
          upRes.error === PAUTA_ACCESS_DENIED
            ? PAUTA_ACCESS_DENIED
            : upRes.error || "Não foi possível atualizar o prazo."
        );
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
    setModalDemandaMultimidia(false);
    setModalSaving(false);
    setModalError(null);
    setModalReportersError(null);
    setModalTab("pauta");
    setEscalaFormDirty(false);
    setEscalaSaving(false);
    setEditingEscala(null);
  }, []);

  const requestCloseDayModal = useCallback(() => {
    if (modalSaving || escalaSaving) return;
    const pautaDirty =
      modalTitulo.trim() !== "" ||
      modalResumo.trim() !== "" ||
      modalReporterId.trim() !== "" ||
      modalDemandaMultimidia;
    if (pautaDirty || escalaFormDirty) {
      if (
        !window.confirm(
          "Você tem dados não salvos. Deseja realmente sair?"
        )
      ) {
        return;
      }
    }
    closeNovaPautaModal();
  }, [
    modalSaving,
    escalaSaving,
    modalTitulo,
    modalResumo,
    modalReporterId,
    modalDemandaMultimidia,
    escalaFormDirty,
    closeNovaPautaModal,
  ]);

  useEffect(() => {
    if (!isModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      requestCloseDayModal();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isModalOpen, requestCloseDayModal]);

  useEffect(() => {
    if (!pautaCalendarioSomenteLeitura) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setPautaCalendarioSomenteLeitura(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pautaCalendarioSomenteLeitura]);

  const handleCalendarDayClick = useCallback((ymd: string) => {
    setSelectedDate(ymd);
    setEditingEscala(null);
    setModalTitulo("");
    setModalResumo("");
    setModalReporterId("");
    setModalEditoria("Últimas Notícias");
    setModalDemandaMultimidia(false);
    setModalError(null);
    setModalReportersError(null);
    setModalTab("pauta");
    setEscalaFormDirty(false);
    setEscalaSaving(false);
    setIsModalOpen(true);
  }, []);

  const handleEscalaCardClick = useCallback(
    (row: EscalaRow, dayYmd: string) => {
      if (!privilegedSession) {
        setFeedbackErro(
          "Acesso negado. Apenas editores podem gerenciar a escala."
        );
        return;
      }
      setSelectedDate(dayYmd);
      setEditingEscala(row);
      setModalTitulo("");
      setModalResumo("");
      setModalReporterId("");
      setModalEditoria("Últimas Notícias");
      setModalDemandaMultimidia(false);
      setModalError(null);
      setModalReportersError(null);
      setModalTab("escala");
      setEscalaFormDirty(false);
      setEscalaSaving(false);
      setIsModalOpen(true);
    },
    [privilegedSession]
  );

  const handleSubmitNovaPautaModal = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!selectedDate) return;
      const titulo = modalTitulo.trim();
      if (!titulo) {
        setModalError("Informe o título.");
        return;
      }
      if (privilegedSession && !modalReporterId.trim()) {
        setModalError("Selecione um repórter.");
        return;
      }
      if (!privilegedSession && !sessionCtx?.userId) {
        setModalError("Sessão inválida. Atualize a página e tente novamente.");
        return;
      }
      setModalError(null);
      setModalSaving(true);
      const insertRes = await createPautaAction({
        titulo_provisorio: titulo,
        fontes: modalResumo.trim() || null,
        deadline: selectedDate,
        reporter_id: privilegedSession
          ? modalReporterId.trim()
          : sessionCtx!.userId,
        editoria: modalEditoria,
        status: "Sugerida",
        arquivos_urls: [],
        demanda_multimidia: modalDemandaMultimidia,
      });
      setModalSaving(false);
      if (!insertRes.ok) {
        setModalError(insertRes.error || "Não foi possível salvar a pauta.");
        return;
      }
      closeNovaPautaModal();
      void refreshDashboardData();
    },
    [
      closeNovaPautaModal,
      refreshDashboardData,
      modalEditoria,
      modalDemandaMultimidia,
      modalReporterId,
      modalResumo,
      modalTitulo,
      privilegedSession,
      selectedDate,
      sessionCtx,
    ]
  );

  const controlsLinha = (
    <div
      className="flex flex-col items-center justify-between gap-4 border-b border-slate-200 px-[15px] py-3 md:flex-row"
      role="search"
      aria-label="Filtros e visualização"
    >
      <div className="flex w-full items-center gap-3 md:w-auto">
        <select
          id="filtro-reporter"
          value={filtroReporter}
          onChange={(e) => setFiltroReporter(e.target.value)}
          className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 md:w-56"
        >
          <option value="Todos">Todos os Repórteres</option>
          {opcoesReporters.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </select>
        <select
          id="filtro-editoria"
          value={filtroEditoria}
          onChange={(e) => setFiltroEditoria(e.target.value)}
          className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 md:w-56"
        >
          <option value="Todos">Todas as Editorias</option>
          {opcoesEditorias.map((ed) => (
            <option key={ed} value={ed}>
              {ed}
            </option>
          ))}
        </select>
      </div>
      <div className="flex w-full flex-wrap items-center justify-end gap-4 md:w-auto">
        <div
          className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5 shadow-inner"
          role="group"
          aria-label="Alternar entre visão mensal e semanal"
        >
          <button
            type="button"
            onClick={() => handleCalendarScopeChange("month")}
            aria-pressed={calendarScope === "month"}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              calendarScope === "month"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Mês
          </button>
          <button
            type="button"
            onClick={() => handleCalendarScopeChange("week")}
            aria-pressed={calendarScope === "week"}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              calendarScope === "week"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Semana
          </button>
        </div>
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
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-0 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/"
            className="inline-block cursor-pointer rounded-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 transition-colors hover:text-slate-700 sm:text-3xl">
            {process.env.NEXT_PUBLIC_TITULO_DASHBOARD || "Painel de Pautas"}
            </h1>
          </Link>
          {sessionCtx ? (
            <p className="mt-2 text-sm">
              <Link
                href={`/admin?editar=${encodeURIComponent(sessionCtx.userId)}`}
                className="font-medium text-blue-700 underline-offset-2 hover:text-blue-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {(sessionCtx.nome ?? "").trim() ||
                  sessionCtx.email ||
                  "Meu cadastro"}
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            Admin
          </Link>
          <Link
            href="/ronda-rss"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            Radar de Pautas
          </Link>
          {privilegedSession ? (
            <Link
              href="/escala"
              className="inline-flex items-center justify-center rounded-md border border-slate-400 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
            >
              Escala
            </Link>
          ) : null}
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

      {!loading && !error && (
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

          {viewMode === "lista" && <div className="mb-6">{controlsLinha}</div>}

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

          {viewMode === "lista" && sortedPautas.length === 0 && (
            <div className="mb-6 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500">
              {pautas.length === 0
                ? "Nenhuma pauta encontrada."
                : "Nenhuma pauta corresponde aos filtros selecionados."}
            </div>
          )}

          {(viewMode === "calendario" || sortedPautas.length > 0) && (
            <>
          {viewMode === "lista" && sortedPautas.length > 0 && (
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
                        disabled={idsVisiveisGerenciaveis.length === 0}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        aria-label="Selecionar todas as pautas visíveis que você pode excluir"
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
                        {canManagePauta(p) ? (
                          <input
                            type="checkbox"
                            checked={selecionadas.includes(p.id)}
                            onChange={() => handleToggleLinha(p.id)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            aria-label={`Selecionar pauta ${p.titulo_provisorio?.trim() || "sem título"}`}
                          />
                        ) : (
                          <span className="inline-block w-4" aria-hidden />
                        )}
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
                        {canManagePauta(p) ? (
                          <DeadlineInlineInput
                            pautaId={p.id}
                            deadline={p.deadline}
                            saving={deadlineSavingId === p.id}
                            onChange={handleDeadlineChange}
                          />
                        ) : (
                          <span className="text-sm tabular-nums text-slate-600">
                            {formatDeadlinePtBR(parseDeadlineToYmd(p.deadline))}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                        {canManagePauta(p) ? (
                          <StatusInlineSelect
                            pautaId={p.id}
                            status={p.status}
                            saving={statusSavingId === p.id}
                            onChange={handleStatusChange}
                          />
                        ) : (
                          <span className="text-sm text-slate-700">
                            {(p.status ?? "").trim() || "—"}
                          </span>
                        )}
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
                  {canManagePauta(p) ? (
                    <input
                      type="checkbox"
                      checked={selecionadas.includes(p.id)}
                      onChange={() => handleToggleLinha(p.id)}
                      className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`Selecionar pauta ${p.titulo_provisorio?.trim() || "sem título"}`}
                    />
                  ) : null}
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
                      {canManagePauta(p) ? (
                        <DeadlineInlineInput
                          pautaId={p.id}
                          deadline={p.deadline}
                          saving={deadlineSavingId === p.id}
                          onChange={handleDeadlineChange}
                        />
                      ) : (
                        <span className="text-sm tabular-nums">
                          {formatDeadlinePtBR(parseDeadlineToYmd(p.deadline))}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Status
                    </dt>
                    <dd className="mt-0.5 max-w-full">
                      {canManagePauta(p) ? (
                        <StatusInlineSelect
                          pautaId={p.id}
                          status={p.status}
                          saving={statusSavingId === p.id}
                          onChange={handleStatusChange}
                        />
                      ) : (
                        <span className="text-sm text-slate-800">
                          {(p.status ?? "").trim() || "—"}
                        </span>
                      )}
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
              escalas={escalas}
              onDropDeadline={handleCalendarDeadlineDrop}
              controlsContent={controlsLinha}
              onDayClick={handleCalendarDayClick}
              onEscalaCardClick={handleEscalaCardClick}
              onPautaChipClick={handleCalendarioPautaChipClick}
              canManageDeadlineForPauta={canManagePauta}
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
            if (
              e.target === e.currentTarget &&
              !modalSaving &&
              !escalaSaving
            ) {
              requestCloseDayModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-day-modal-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2
                id="calendar-day-modal-title"
                className="text-lg font-semibold text-slate-900"
              >
                {formatDeadlinePtBR(selectedDate)}
              </h2>
              <button
                type="button"
                onClick={() => requestCloseDayModal()}
                className="shrink-0 rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Fechar"
                disabled={modalSaving || escalaSaving}
              >
                ×
              </button>
            </div>

            <div
              className="mt-4 flex gap-1 border-b border-slate-200"
              role="tablist"
              aria-label="Tipo de cadastro"
            >
              <button
                type="button"
                role="tab"
                aria-selected={modalTab === "pauta"}
                onClick={() => setModalTab("pauta")}
                disabled={modalSaving || escalaSaving}
                className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  modalTab === "pauta"
                    ? "border-blue-600 font-semibold text-slate-900"
                    : "border-transparent font-medium text-slate-600 hover:text-slate-900"
                }`}
              >
                Nova Pauta
              </button>
              {privilegedSession ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={modalTab === "escala"}
                  onClick={() => setModalTab("escala")}
                  disabled={modalSaving || escalaSaving}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    modalTab === "escala"
                      ? "border-blue-600 font-semibold text-slate-900"
                      : "border-transparent font-medium text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Escala
                </button>
              ) : null}
            </div>

            {modalTab === "pauta" && (
              <>
                <p className="mt-3 text-sm text-slate-600">
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
                  <div className="flex items-start gap-2 pt-0.5">
                    <input
                      id="modal-pauta-demanda-multimidia"
                      type="checkbox"
                      checked={modalDemandaMultimidia}
                      onChange={(e) => setModalDemandaMultimidia(e.target.checked)}
                      disabled={modalSaving}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-slate-900 focus:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <label
                      htmlFor="modal-pauta-demanda-multimidia"
                      className="cursor-pointer text-sm text-slate-700"
                    >
                      Demanda Multimídia
                    </label>
                  </div>
                  {privilegedSession ? (
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
                        <p className="mt-1 text-xs text-red-700">
                          {modalReportersError}
                        </p>
                      )}
                      <select
                        id="modal-pauta-reporter"
                        value={modalReporterId}
                        onChange={(e) => setModalReporterId(e.target.value)}
                        disabled={
                          modalSaving ||
                          modalReportersLoading ||
                          modalReporters.length === 0
                        }
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
                  ) : (
                    <p className="text-sm text-slate-600">
                      Esta pauta será atribuída a você como repórter.
                    </p>
                  )}
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
                      onClick={() => requestCloseDayModal()}
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
              </>
            )}

            {privilegedSession && modalTab === "escala" && (
              <div className="mt-4" role="tabpanel">
                <p className="mb-3 text-sm text-slate-600">
                  {editingEscala ? (
                    <>
                      Editando entrada de{" "}
                      <span className="font-medium text-slate-800">
                        {formatDeadlinePtBR(selectedDate)}
                      </span>
                      . Use <span className="font-medium">Excluir</span> no
                      rodapé para remover.
                    </>
                  ) : (
                    <>
                      Data do calendário:{" "}
                      <span className="font-medium text-slate-800">
                        {formatDeadlinePtBR(selectedDate)}
                      </span>{" "}
                      — ao escolher o tipo, os campos de data serão preenchidos
                      com este dia (férias: início e fim).
                    </>
                  )}
                </p>
                <EscalaForm
                  key={
                    editingEscala
                      ? `modal-escala-edit-${editingEscala.id}`
                      : `modal-escala-new-${selectedDate}`
                  }
                  variant="embedded"
                  defaultDateYmd={selectedDate}
                  initialEscala={escalaFormInitial}
                  usuarios={modalReporters}
                  usuariosLoading={modalReportersLoading}
                  idPrefix="modal-escala"
                  onSuccess={() => {
                    closeNovaPautaModal();
                    void refreshDashboardData();
                  }}
                  onDirtyChange={setEscalaFormDirty}
                  onSavingChange={setEscalaSaving}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {pautaCalendarioSomenteLeitura && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPautaCalendarioSomenteLeitura(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pauta-calendario-sl-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2
                id="pauta-calendario-sl-title"
                className="text-lg font-semibold text-slate-900"
              >
                Pauta (somente leitura)
              </h2>
              <button
                type="button"
                onClick={() => setPautaCalendarioSomenteLeitura(null)}
                className="shrink-0 rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Você pode ver esta pauta no calendário, mas só o repórter
              responsável, editores ou o administrador podem alterá-la.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="cal-sl-titulo"
                  className="block text-sm font-medium text-slate-700"
                >
                  Título
                </label>
                <input
                  id="cal-sl-titulo"
                  type="text"
                  value={
                    pautaCalendarioSomenteLeitura.titulo_provisorio?.trim() ||
                    "Sem título"
                  }
                  readOnly
                  disabled
                  className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 opacity-90"
                />
              </div>
              <div>
                <label
                  htmlFor="cal-sl-reporter"
                  className="block text-sm font-medium text-slate-700"
                >
                  Repórter
                </label>
                <input
                  id="cal-sl-reporter"
                  type="text"
                  value={reporterNome(pautaCalendarioSomenteLeitura)}
                  readOnly
                  disabled
                  className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 opacity-90"
                />
              </div>
              <div>
                <label
                  htmlFor="cal-sl-editoria"
                  className="block text-sm font-medium text-slate-700"
                >
                  Editoria
                </label>
                <input
                  id="cal-sl-editoria"
                  type="text"
                  value={pautaCalendarioSomenteLeitura.editoria?.trim() || "—"}
                  readOnly
                  disabled
                  className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 opacity-90"
                />
              </div>
              <div>
                <label
                  htmlFor="cal-sl-prazo"
                  className="block text-sm font-medium text-slate-700"
                >
                  Prazo
                </label>
                <input
                  id="cal-sl-prazo"
                  type="text"
                  value={formatDeadlinePtBR(
                    parseDeadlineToYmd(pautaCalendarioSomenteLeitura.deadline)
                  )}
                  readOnly
                  disabled
                  className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 opacity-90"
                />
              </div>
              <div>
                <label
                  htmlFor="cal-sl-status"
                  className="block text-sm font-medium text-slate-700"
                >
                  Status
                </label>
                <select
                  id="cal-sl-status"
                  value={pautaCalendarioSomenteLeitura.status}
                  disabled
                  className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 opacity-90"
                >
                  {STATUS_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-start gap-2 pt-0.5">
                <input
                  id="cal-sl-dm"
                  type="checkbox"
                  checked={pautaCalendarioSomenteLeitura.demanda_multimidia}
                  readOnly
                  disabled
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-not-allowed rounded border-slate-300 text-slate-900 opacity-90"
                />
                <label htmlFor="cal-sl-dm" className="text-sm text-slate-500">
                  Demanda Multimídia
                </label>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Link
                href={`/pauta/${pautaCalendarioSomenteLeitura.id}`}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
              >
                Abrir página completa
              </Link>
              <button
                type="button"
                onClick={() => setPautaCalendarioSomenteLeitura(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
