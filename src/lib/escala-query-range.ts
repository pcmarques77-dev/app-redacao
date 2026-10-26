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
