"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
} from "react";
import {
  clearPlantoesForDateAction,
  deleteEscala,
  listEscalasOverlappingMonthPlannerAction,
  movePlantaoToDateAction,
  savePlantaoForDateAction,
  type EscalaDashboardRow,
} from "@/app/actions/escalas";
import { listReportersForSessionAction } from "@/app/actions/pautas";
import { HelpHint } from "@/components/HelpHint";
import { PlannerMonthPicker } from "@/components/PlannerMonthPicker";
import {
  getOfficialFederalObservancesForYear,
  getOfficialObservanceForDay,
  type BrFederalObservance,
} from "@/lib/br-federal-calendar";
import { getEfemeridesForDay, efemerideEmoji } from "@/lib/br-efemerides";
import { decemberThroughFirstWeekendNextYearYmds } from "@/lib/escala-planner-spill";
import {
  PLANNER_DAY_CARD,
  PLANNER_JOURNALIST_CHIP,
  PLANNER_SLOT_DROP_SURFACE,
  plannerWeekHeaderSurface,
} from "@/lib/planner-chroma";
import { ESCALA_TIPO_PLANTAO } from "@/lib/escala-constants";

const MIME_USER = "application/x-escala-usuario-id";
const MIME_PLANTAO_ROW = "application/x-escala-plantao-row-id";

const SIDEBAR_JORNALISTAS_HELP =
  "Arraste para cada dia especial na grade (fins de semana, feriados e pontos facultativos federais quando houver calendário no sistema, mais feriados que você cadastrar em Escala). Plantões já salvos podem ser arrastados pelo nome para outro dia. Vários nomes por dia; o mesmo nome não se repete no mesmo dia.";

function dateToYmd(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Índice 0 = segunda … 6 = domingo */
function weekdayIndexMondayFirst(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** JS getDay(): 0 = domingo … 6 = sábado */
function weekdayJsSunday0(d: Date): number {
  return d.getDay();
}

function plannerSlotDropSurfaceClasses(_ymd: string, busy: boolean): string {
  if (busy)
    return "bg-slate-100 ring-1 ring-inset ring-slate-300";
  return `${PLANNER_SLOT_DROP_SURFACE} transition`;
}

/**
 * Ordem no planejador dentro da semana (seg–dom): qua–sex por calendário,
 * depois sábado e domingo, depois segunda e terça (feriados/pontes ligados ao fim de semana).
 */
function sortEligibleDatesWithinPlannerWeek(dates: string[]): string[] {
  const wedThuFri: string[] = [];
  const sat: string[] = [];
  const sun: string[] = [];
  const monTue: string[] = [];

  for (const ymd of dates) {
    const dow = weekdayJsSunday0(parseYmdLocal(ymd));
    if (dow === 6) sat.push(ymd);
    else if (dow === 0) sun.push(ymd);
    else if (dow === 1 || dow === 2) monTue.push(ymd);
    else wedThuFri.push(ymd);
  }

  wedThuFri.sort();
  sat.sort();
  sun.sort();
  monTue.sort();

  return [...wedThuFri, ...sat, ...sun, ...monTue];
}

function startOfWeekMonday(from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() - weekdayIndexMondayFirst(d));
  return d;
}

/**
 * Segunda-feira da “semana do planejador”: iguais à semana civil (seg–dom),
 * exceto segunda e terça — ficam no mesmo bloco visual que o sábado e o
 * domingo imediatamente anteriores (feriado/ponte colado ao fim de semana).
 */
function plannerWeekMondayForYmd(ymd: string): string {
  const d = parseYmdLocal(ymd);
  const dow = weekdayJsSunday0(d);
  if (dow === 1 || dow === 2) {
    const anchor = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7);
    return dateToYmd(startOfWeekMonday(anchor));
  }
  return dateToYmd(startOfWeekMonday(d));
}

function weekendDatesInMonth(year: number, monthIndex: number): string[] {
  const out: string[] = [];
  const last = new Date(year, monthIndex + 1, 0).getDate();
  for (let dayNum = 1; dayNum <= last; dayNum++) {
    const dt = new Date(year, monthIndex, dayNum);
    const dow = dt.getDay();
    if (dow === 0 || dow === 6) {
      out.push(dateToYmd(dt));
    }
  }
  return out;
}

/** Sábado anterior ou domingo seguinte quando o fim de semana corta a virada do mês. */
function crossMonthWeekendBridgeYmds(year: number, monthIndex: number): string[] {
  const extra: string[] = [];
  const firstOfMonth = new Date(year, monthIndex, 1);
  if (firstOfMonth.getDay() === 0) {
    const prevSat = new Date(year, monthIndex, 0);
    if (prevSat.getDay() === 6) {
      extra.push(dateToYmd(prevSat));
    }
  }
  const lastOfMonth = new Date(year, monthIndex + 1, 0);
  if (lastOfMonth.getDay() === 6) {
    extra.push(dateToYmd(new Date(year, monthIndex + 1, 1)));
  }
  return extra;
}

function enumerateInclusive(start: string, end: string): string[] {
  if (!start || !end || start > end) return [];
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    const d = parseYmdLocal(cur);
    d.setDate(d.getDate() + 1);
    cur = dateToYmd(d);
  }
  return out;
}

function normalizeTipoKey(t: string | null): string {
  return (t ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function isFeriadoTipoPlanner(t: string | null): boolean {
  const n = normalizeTipoKey(t);
  return n === "feriado" || n === "coordenacao";
}

/** DD/MM */
function shortDmFromYmd(ymd: string): string {
  const [y, mo, d] = ymd.split("-");
  if (!y || !mo || !d) return ymd;
  return `${d.padStart(2, "0")}/${mo.padStart(2, "0")}`;
}

/** Intervalo DD/MM–DD/MM coberto pelas datas do bloco (ordem cronológica). */
function plannerBlockSpanLabel(dates: string[]): string {
  if (dates.length === 0) return "";
  const sorted = [...dates].sort();
  const lo = sorted[0]!;
  const hi = sorted[sorted.length - 1]!;
  return `${shortDmFromYmd(lo)}–${shortDmFromYmd(hi)}`;
}

function dayKindLabel(ymd: string): string {
  const d = parseYmdLocal(ymd);
  const wd = d.toLocaleDateString("pt-BR", { weekday: "short" });
  return `${wd}. ${shortDmFromYmd(ymd)}`;
}

/** Dias em que se pode lançar plantão no mês: fins de semana + feriados/pontos federais (ano com dados) + feriados cadastrados em Escala. */
function eligiblePlantaoDatesForMonth(
  year: number,
  monthIndex: number,
  escalas: EscalaDashboardRow[]
): string[] {
  const monthStart = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const monthEnd = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const bridge = crossMonthWeekendBridgeYmds(year, monthIndex);
  const yearEndSpill =
    monthIndex === 11 ? decemberThroughFirstWeekendNextYearYmds(year) : [];

  let displayStart = monthStart;
  let displayEnd = monthEnd;
  for (const ymd of [...bridge, ...yearEndSpill]) {
    if (ymd < displayStart) displayStart = ymd;
    if (ymd > displayEnd) displayEnd = ymd;
  }

  const set = new Set<string>();

  for (const ymd of weekendDatesInMonth(year, monthIndex)) {
    set.add(ymd);
  }
  for (const ymd of bridge) {
    set.add(ymd);
  }
  for (const ymd of yearEndSpill) {
    set.add(ymd);
  }

  const yearsToScan = new Set<number>([year]);
  for (const ymd of [...bridge, ...yearEndSpill]) {
    yearsToScan.add(Number(ymd.slice(0, 4)));
  }
  for (const y of yearsToScan) {
    for (const o of getOfficialFederalObservancesForYear(y)) {
      if (o.ymd >= displayStart && o.ymd <= displayEnd) {
        set.add(o.ymd);
      }
    }
  }

  for (const e of escalas.filter((row) => isFeriadoTipoPlanner(row.tipo))) {
    const ini = e.data_inicio?.trim() ?? "";
    const fim = e.data_fim?.trim() || ini;
    if (!ini) continue;
    for (const d of enumerateInclusive(ini, fim)) {
      if (d >= displayStart && d <= displayEnd) set.add(d);
    }
  }

  return [...set].sort();
}

function groupEligibleDatesByWeek(
  eligibleSorted: string[]
): { mondayYmd: string; dates: string[] }[] {
  const map = new Map<string, string[]>();
  for (const ymd of eligibleSorted) {
    const mon = plannerWeekMondayForYmd(ymd);
    const arr = map.get(mon) ?? [];
    arr.push(ymd);
    map.set(mon, arr);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mondayYmd, dates]) => ({
      mondayYmd,
      dates: sortEligibleDatesWithinPlannerWeek(dates),
    }));
}

function observanceHintLine(o: BrFederalObservance): string {
  const base =
    o.kind === "feriado_nacional"
      ? `${o.title} — feriado nacional`
      : `${o.title} — ponto facultativo`;
  return o.note ? `${base} (${o.note})` : base;
}

function dayCalendarHints(ymd: string, escalas: EscalaDashboardRow[]): string[] {
  const hints: string[] = [];

  const observanceYear = Number(ymd.slice(0, 4));
  const official = getOfficialObservanceForDay(ymd, observanceYear);
  if (official) {
    hints.push(observanceHintLine(official));
  }

  const iniEndPairs: { nome: string; ini: string; fim: string }[] = [];
  for (const e of escalas.filter((row) => isFeriadoTipoPlanner(row.tipo))) {
    const ini = e.data_inicio?.trim() ?? "";
    const fim = e.data_fim?.trim() || ini;
    const nome = e.coordenador?.trim() || "Feriado";
    if (!ini) continue;
    iniEndPairs.push({ nome, ini, fim });
  }

  for (const { nome, ini, fim } of iniEndPairs) {
    if (ymd >= ini && ymd <= fim) {
      const label =
        ini === fim
          ? `${nome} — cadastro (escala)`
          : `${nome} — cadastro (${shortDmFromYmd(ini)}–${shortDmFromYmd(fim)})`;
      if (!hints.some((h) => h.includes(nome) && h.includes("cadastro"))) {
        hints.push(label);
      }
    }
  }

  for (const ef of getEfemeridesForDay(ymd)) {
    hints.push(`${efemerideEmoji(ef)} ${ef.title} — efeméride`);
  }

  return hints;
}

export function EscalaWeekendPlanner() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(() => now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(() => now.getMonth());

  const [usuarios, setUsuarios] = useState<{ id: string; nome: string | null }[]>(
    []
  );
  const [usuariosErr, setUsuariosErr] = useState<string | null>(null);
  const [escalas, setEscalas] = useState<EscalaDashboardRow[]>([]);
  const [escalasErr, setEscalasErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const eligibleSorted = useMemo(
    () => eligiblePlantaoDatesForMonth(year, monthIndex, escalas),
    [year, monthIndex, escalas]
  );

  const eligibleSet = useMemo(() => new Set(eligibleSorted), [eligibleSorted]);

  const weekBlocks = useMemo(
    () => groupEligibleDatesByWeek(eligibleSorted),
    [eligibleSorted]
  );

  const plantaoPorData = useMemo(() => {
    const map = new Map<string, EscalaDashboardRow[]>();
    for (const e of escalas) {
      if ((e.tipo ?? "").trim() !== ESCALA_TIPO_PLANTAO) continue;
      const di = e.data_inicio?.trim();
      if (!di || !eligibleSet.has(di)) continue;
      const arr = map.get(di) ?? [];
      arr.push(e);
      map.set(di, arr);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) =>
        (a.usuarios?.nome ?? "").localeCompare(b.usuarios?.nome ?? "", "pt-BR")
      );
    }
    return map;
  }, [escalas, eligibleSet]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setUsuariosErr(null);
    setEscalasErr(null);
    const [uRes, eRes] = await Promise.all([
      listReportersForSessionAction(),
      listEscalasOverlappingMonthPlannerAction(year, monthIndex),
    ]);
    if (!uRes.ok) setUsuariosErr(uRes.error);
    else setUsuarios(uRes.rows);
    if (!eRes.ok) setEscalasErr(eRes.error);
    else setEscalas(eRes.rows);
    setLoading(false);
  }, [year, monthIndex]);

  /** Atualiza só escalas após mutações — não usa `loading`, evita sumir a grade inteira. */
  const reloadEscalasOnly = useCallback(async () => {
    const eRes = await listEscalasOverlappingMonthPlannerAction(year, monthIndex);
    if (!eRes.ok) setEscalasErr(eRes.error);
    else {
      setEscalasErr(null);
      setEscalas(eRes.rows);
    }
  }, [year, monthIndex]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 7000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const plannerCalendarYearBounds = useMemo(() => {
    const yNow = now.getFullYear();
    return {
      min: Math.min(year, yNow) - 3,
      max: Math.max(year, yNow) + 3,
    };
  }, [year, now]);

  const handlePlannerCalendarShiftMonths = (delta: number) => {
    const d = new Date(year, monthIndex + delta, 1);
    setYear(d.getFullYear());
    setMonthIndex(d.getMonth());
  };

  const onDragStartUsuario = (e: DragEvent<HTMLDivElement>, usuarioId: string) => {
    e.dataTransfer.setData(MIME_USER, usuarioId);
    e.dataTransfer.effectAllowed = "copy";
  };

  const onDragStartPlantaoRow = (
    e: DragEvent<HTMLDivElement>,
    plantaoEscalaId: string
  ) => {
    e.dataTransfer.setData(MIME_PLANTAO_ROW, plantaoEscalaId);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDropSlot = async (e: DragEvent<HTMLDivElement>, dateYmd: string | null) => {
    e.preventDefault();
    if (!dateYmd) return;

    const plantaoRowId = e.dataTransfer.getData(MIME_PLANTAO_ROW).trim();
    if (plantaoRowId) {
      setBusyDate(dateYmd);
      setToast(null);
      const res = await movePlantaoToDateAction(plantaoRowId, dateYmd);
      if (!res.ok) {
        setBusyDate(null);
        setToast(res.error);
        return;
      }
      await reloadEscalasOnly();
      setBusyDate(null);
      return;
    }

    const uid = e.dataTransfer.getData(MIME_USER).trim();
    if (!uid) return;
    setBusyDate(dateYmd);
    setToast(null);
    const res = await savePlantaoForDateAction(dateYmd, uid);
    if (!res.ok) {
      setBusyDate(null);
      setToast(res.error);
      return;
    }
    await reloadEscalasOnly();
    setBusyDate(null);
  };

  const onDragOverSlot = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const types = [...e.dataTransfer.types];
    if (types.includes(MIME_PLANTAO_ROW)) {
      e.dataTransfer.dropEffect = "move";
    } else if (types.includes(MIME_USER)) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const clearSlot = async (dateYmd: string) => {
    if (!window.confirm("Remover todos os plantões deste dia?")) return;
    setBusyDate(dateYmd);
    setToast(null);
    const res = await clearPlantoesForDateAction(dateYmd);
    if (!res.ok) {
      setBusyDate(null);
      setToast(res.error);
      return;
    }
    await reloadEscalasOnly();
    setBusyDate(null);
  };

  const removeOnePlantao = async (id: string) => {
    setDeletingId(id);
    setToast(null);
    const res = await deleteEscala(id);
    if (!res.ok) {
      setDeletingId(null);
      setToast(res.error);
      return;
    }
    await reloadEscalasOnly();
    setDeletingId(null);
  };

  const renderSlot = (ymd: string | null) => {
    if (!ymd) return null;

    const feriadoHints = dayCalendarHints(ymd, escalas);
    const plantoes = plantaoPorData.get(ymd) ?? [];
    const busy = busyDate === ymd;

    return (
      <div
        style={{
          backgroundColor: PLANNER_DAY_CARD.bg,
          borderColor: PLANNER_DAY_CARD.border,
        }}
        className="flex h-full min-h-[100px] w-full flex-col rounded-lg border shadow-sm"
      >
        {feriadoHints.length > 0 && (
          <div
            style={{ borderBottomColor: PLANNER_DAY_CARD.border }}
            className="space-y-0.5 border-b px-2 py-1.5"
          >
            {feriadoHints.map((hint, i) => (
              <div
                key={`${ymd}-hint-${i}`}
                className="font-semibold leading-snug text-slate-800"
              >
                {hint}
              </div>
            ))}
          </div>
        )}
        <div
          style={{ borderBottomColor: PLANNER_DAY_CARD.border }}
          className="flex items-center justify-between gap-1 border-b px-2 py-1"
        >
          <span className="font-semibold capitalize tracking-wide text-slate-700">
            {dayKindLabel(ymd)}
          </span>
          {plantoes.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void clearSlot(ymd)}
              className="font-medium text-red-600 hover:underline disabled:opacity-40"
            >
              Limpar dia
            </button>
          )}
        </div>
        <div
          onDragOver={(ev) => onDragOverSlot(ev)}
          onDrop={(ev) => void onDropSlot(ev, ymd)}
          className={`flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2 ${plannerSlotDropSurfaceClasses(ymd, busy)}`}
        >
          {plantoes.length === 0 ? (
            <p className="flex flex-1 items-center leading-snug text-slate-400">
              Arraste jornalistas para lançar ou arraste um plantão salvo para
              mudar de dia
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {plantoes.map((p) => {
                return (
                  <li
                    key={p.id}
                    style={{
                      backgroundColor: PLANNER_JOURNALIST_CHIP.bg,
                      borderColor: PLANNER_JOURNALIST_CHIP.border,
                    }}
                    className="flex items-center justify-between gap-1 rounded border px-1.5 py-1 font-medium text-slate-800 shadow-sm"
                  >
                    <div
                      draggable={deletingId !== p.id}
                      onDragStart={(ev) => {
                        if (deletingId === p.id) {
                          ev.preventDefault();
                          return;
                        }
                        onDragStartPlantaoRow(ev, p.id);
                      }}
                      className={`min-w-0 flex-1 truncate px-0.5 py-0.5 ${
                        deletingId === p.id
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-grab active:cursor-grabbing"
                      }`}
                      title="Arrastar para outro dia"
                    >
                      {p.usuarios?.nome?.trim() || "Sem nome"}
                    </div>
                    <button
                      type="button"
                      disabled={deletingId === p.id}
                      aria-label={`Remover plantão ${p.usuarios?.nome ?? ""}`}
                      onMouseDown={(ev) => ev.stopPropagation()}
                      onClick={() => void removeOnePlantao(p.id)}
                      className="shrink-0 rounded px-1 text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {toast && (
        <div
          className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 shadow-lg"
          role="alert"
        >
          <p className="min-w-0 flex-1">{toast}</p>
          <button
            type="button"
            className="shrink-0 text-amber-800 hover:text-amber-950"
            aria-label="Fechar"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-col gap-6 bg-white text-[13px] leading-snug text-slate-800 sm:gap-8 lg:flex-row lg:items-start">
        <aside className="w-full shrink-0 lg:w-[13.5rem] lg:max-w-[13.5rem]">
          <div className="flex flex-wrap items-start gap-x-1 gap-y-0.5">
            <h2 className="font-semibold uppercase tracking-wide text-slate-600">
              Jornalistas
            </h2>
            <HelpHint title={SIDEBAR_JORNALISTAS_HELP} />
          </div>
          <p className="mt-0.5 text-slate-500">
            Arraste nomes para cada dia destacado na grade.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-2 lg:grid-cols-1">
            {usuariosErr && (
              <p className="col-span-full text-red-700">{usuariosErr}</p>
            )}
            {!loading &&
              usuarios.map((u) => (
                <div
                  key={u.id}
                  draggable
                  onDragStart={(ev) => onDragStartUsuario(ev, u.id)}
                  style={{
                    backgroundColor: PLANNER_JOURNALIST_CHIP.bg,
                    borderColor: PLANNER_JOURNALIST_CHIP.border,
                  }}
                  className="flex min-h-[30px] cursor-grab items-center rounded border px-1.5 py-0.5 font-medium leading-tight text-slate-800 shadow-sm transition hover:brightness-[0.98] active:cursor-grabbing"
                >
                  <span className="min-w-0 truncate">
                    {u.nome?.trim() || "Sem nome"}
                  </span>
                </div>
              ))}
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <button
              type="button"
              onClick={() => handlePlannerCalendarShiftMonths(-1)}
              className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              ← Mês anterior
            </button>
            <PlannerMonthPicker
              year={year}
              monthIndex={monthIndex}
              yearMin={plannerCalendarYearBounds.min}
              yearMax={plannerCalendarYearBounds.max}
              onCommit={(y, m) => {
                setYear(y);
                setMonthIndex(m);
              }}
            />
            <button
              type="button"
              onClick={() => handlePlannerCalendarShiftMonths(1)}
              className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Próximo mês →
            </button>
          </div>

          {escalasErr && (
            <p className="mt-3 text-red-700" role="alert">
              {escalasErr}
            </p>
          )}

          <div className="mt-4">
            {loading && (
              <p className="text-slate-500" role="status">
                Carregando…
              </p>
            )}

            {!loading && (
              <div className="space-y-3">
                {weekBlocks.map((block, weekIdx) => {
                  const header = plannerWeekHeaderSurface(weekIdx);
                  return (
                    <div
                      key={block.mondayYmd}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    >
                      <div
                        style={{
                          backgroundColor: header.bg,
                          borderBottomColor: header.border,
                        }}
                        className="border-b px-3 py-2"
                      >
                        <p className="font-semibold uppercase tracking-wide text-slate-700">
                          Fim de semana {plannerBlockSpanLabel(block.dates)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-stretch gap-2 p-2 sm:p-3">
                        {block.dates.map((ymd) => (
                          <div
                            key={ymd}
                            className="flex min-w-[min(100%,140px)] max-w-[220px] flex-1 basis-[min(100%,160px)] flex-col self-stretch sm:min-w-[160px] sm:basis-[160px]"
                          >
                            {renderSlot(ymd)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
