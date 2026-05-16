/**
 * Extensões de intervalo do planejador de plantões (viradas de mês / ano).
 */

function dateToYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Em dezembro, inclui em janeiro do ano seguinte todos os dias de 1/1 até o domingo
 * que fecha o primeiro fim de semana civil (primeiro sábado do ano + domingo seguinte).
 * Ex.: 2027 — sex 1/1 (feriado), sáb 2, dom 3.
 */
export function decemberThroughFirstWeekendNextYearYmds(
  decemberYear: number
): string[] {
  const nextY = decemberYear + 1;
  const firstSat = new Date(nextY, 0, 1);
  while (firstSat.getDay() !== 6) {
    firstSat.setDate(firstSat.getDate() + 1);
  }
  const sundayAfterFirstSat = new Date(firstSat);
  sundayAfterFirstSat.setDate(sundayAfterFirstSat.getDate() + 1);

  const out: string[] = [];
  let cur = new Date(nextY, 0, 1);
  while (cur <= sundayAfterFirstSat) {
    out.push(dateToYmdLocal(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
