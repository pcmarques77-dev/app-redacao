import { decemberThroughFirstWeekendNextYearYmds } from "@/lib/escala-planner-spill";

export function dateToYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function monthBoundsYm(
  year: number,
  monthIndex: number
): { monthStart: string; monthEnd: string } {
  const monthStart = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const monthEnd = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { monthStart, monthEnd };
}

/**
 * Intervalo de `data_inicio` a carregar no planejador: inclui um dia extra quando o
 * fim de semana “atravessa” o limite do mês (ex.: sábado 31/10 + domingo 01/11).
 */
export function plannerQueryRangeYm(
  year: number,
  monthIndex: number
): { rangeStart: string; rangeEnd: string } {
  const { monthStart, monthEnd } = monthBoundsYm(year, monthIndex);
  let rangeStart = monthStart;
  let rangeEnd = monthEnd;

  const firstOfMonth = new Date(year, monthIndex, 1);
  if (firstOfMonth.getDay() === 0) {
    const prevSat = new Date(year, monthIndex, 0);
    if (prevSat.getDay() === 6) {
      rangeStart = dateToYmdLocal(prevSat);
    }
  }

  const lastOfMonth = new Date(year, monthIndex + 1, 0);
  if (lastOfMonth.getDay() === 6) {
    const nextSun = new Date(year, monthIndex + 1, 1);
    rangeEnd = dateToYmdLocal(nextSun);
  }

  if (monthIndex === 11) {
    const spill = decemberThroughFirstWeekendNextYearYmds(year);
    const spillEnd = spill[spill.length - 1];
    if (spillEnd && spillEnd > rangeEnd) rangeEnd = spillEnd;
  }

  return { rangeStart, rangeEnd };
}

export function ymdAddDays(ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  dt.setDate(dt.getDate() + days);
  return dateToYmdLocal(dt);
}

/** Grade de produção: semana atual + 3 seguintes. */
export const DASHBOARD_HORIZON_WEEKS = 4;
export const DASHBOARD_HORIZON_DAYS = DASHBOARD_HORIZON_WEEKS * 7;

/** Página da vista de lista. O calendário não usa este limite. */
export const PAUTAS_LIST_PAGE_SIZE = 40;

/** Segunda-feira da semana local de `from` (hora zerada). */
export function startOfWeekMondayLocal(from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const mondayIndex = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayIndex);
  return d;
}

/**
 * Data civil em São Paulo, como `Date` local.
 * O servidor (UTC) e o navegador da redação passam a cair na mesma semana.
 */
export function dateInSaoPaulo(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return new Date(
    pick("year"),
    pick("month") - 1,
    pick("day"),
    pick("hour"),
    pick("minute"),
    pick("second")
  );
}

export type DashboardEscalaQueryInput = {
  year: number;
  monthIndex: number;
  /** Segunda-feira do recorte rolante de 4 semanas (vista de produção). */
  horizonStartYmd?: string;
  /** Mês civil completo (arquivo). */
  archive?: boolean;
};

export function dashboardHorizonQueryRange(horizonStartYmd: string): {
  rangeStart: string;
  rangeEnd: string;
} {
  const start = horizonStartYmd.trim();
  return {
    rangeStart: start,
    rangeEnd: ymdAddDays(start, DASHBOARD_HORIZON_DAYS - 1),
  };
}

/** Intervalo de escalas visível no calendário da home (recorte rolante ou mês civil). */
export function dashboardEscalaQueryRange(
  input: DashboardEscalaQueryInput
): { rangeStart: string; rangeEnd: string } {
  if (!input.archive) {
    const horizon = (input.horizonStartYmd ?? "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(horizon)) {
      return dashboardHorizonQueryRange(horizon);
    }
  }
  return plannerQueryRangeYm(input.year, input.monthIndex);
}

/** Recorte inicial do calendário: semana corrente em São Paulo, sem arquivo. */
export function defaultDashboardQueryInput(now = new Date()): DashboardEscalaQueryInput {
  const monday = startOfWeekMondayLocal(dateInSaoPaulo(now));
  return {
    year: monday.getFullYear(),
    monthIndex: monday.getMonth(),
    horizonStartYmd: dateToYmdLocal(monday),
    archive: false,
  };
}

export function sameDashboardQuery(
  a: DashboardEscalaQueryInput,
  b: DashboardEscalaQueryInput
): boolean {
  return (
    a.year === b.year &&
    a.monthIndex === b.monthIndex &&
    Boolean(a.archive) === Boolean(b.archive) &&
    (a.horizonStartYmd ?? "") === (b.horizonStartYmd ?? "")
  );
}

/**
 * Limites UTC do prazo (`timestamptz`) para o intervalo civil YYYY-MM-DD.
 * O fim é exclusivo (dia seguinte) para não cortar horários do último dia.
 * O dia civil usado na grade é o prefixo ISO, o mesmo recorte daqui.
 */
export function deadlineBoundsForRange(
  rangeStart: string,
  rangeEnd: string
): { gte: string; lt: string } {
  return {
    gte: `${rangeStart}T00:00:00.000Z`,
    lt: `${ymdAddDays(rangeEnd, 1)}T00:00:00.000Z`,
  };
}
