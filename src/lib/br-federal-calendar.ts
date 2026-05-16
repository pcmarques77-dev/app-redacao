/**
 * Calendário federal de referência — feriados nacionais e pontos facultativos.
 * Fonte: Portaria MGI nº 11.460/2025 (calendário oficial 2026 divulgado pelo MGI).
 * https://www.gov.br/gestao/pt-br/assuntos/noticias/2025/dezembro/confira-o-calendario-oficial-de-feriados-nacionais-e-pontos-facultativos-em-2026
 */

export type BrObservanceKind = "feriado_nacional" | "ponto_facultativo";

export type BrFederalObservance = {
  ymd: string;
  kind: BrObservanceKind;
  title: string;
  /** Observações da portaria (meio período etc.), só para exibição */
  note?: string;
};

/** Calendário oficial federal — ano de 2026 */
export const BR_FEDERAL_OBSERVANCES_2026: readonly BrFederalObservance[] = [
  {
    ymd: "2026-01-01",
    kind: "feriado_nacional",
    title: "Confraternização Universal",
  },
  { ymd: "2026-02-16", kind: "ponto_facultativo", title: "Carnaval" },
  { ymd: "2026-02-17", kind: "ponto_facultativo", title: "Carnaval" },
  {
    ymd: "2026-02-18",
    kind: "ponto_facultativo",
    title: "Quarta-feira de Cinzas",
    note: "ponto facultativo até 14h",
  },
  {
    ymd: "2026-04-03",
    kind: "feriado_nacional",
    title: "Paixão de Cristo",
  },
  {
    ymd: "2026-04-20",
    kind: "ponto_facultativo",
    title: "Ponto facultativo",
  },
  { ymd: "2026-04-21", kind: "feriado_nacional", title: "Tiradentes" },
  {
    ymd: "2026-05-01",
    kind: "feriado_nacional",
    title: "Dia Mundial do Trabalho",
  },
  {
    ymd: "2026-06-04",
    kind: "ponto_facultativo",
    title: "Corpus Christi",
  },
  {
    ymd: "2026-06-05",
    kind: "ponto_facultativo",
    title: "Ponto facultativo",
  },
  {
    ymd: "2026-09-07",
    kind: "feriado_nacional",
    title: "Independência do Brasil",
  },
  {
    ymd: "2026-10-12",
    kind: "feriado_nacional",
    title: "Nossa Senhora Aparecida",
  },
  {
    ymd: "2026-10-28",
    kind: "ponto_facultativo",
    title: "Dia do Servidor Público federal",
  },
  { ymd: "2026-11-02", kind: "feriado_nacional", title: "Finados" },
  {
    ymd: "2026-11-15",
    kind: "feriado_nacional",
    title: "Proclamação da República",
  },
  {
    ymd: "2026-11-20",
    kind: "feriado_nacional",
    title: "Dia Nacional de Zumbi e da Consciência Negra",
  },
  {
    ymd: "2026-12-24",
    kind: "ponto_facultativo",
    title: "Véspera do Natal",
    note: "ponto facultativo após 13h",
  },
  { ymd: "2026-12-25", kind: "feriado_nacional", title: "Natal" },
  {
    ymd: "2026-12-31",
    kind: "ponto_facultativo",
    title: "Véspera do Ano Novo",
    note: "ponto facultativo após 13h",
  },
];

const BR_FEDERAL_OBSERVANCES_2027_MIN: readonly BrFederalObservance[] = [
  {
    ymd: "2027-01-01",
    kind: "feriado_nacional",
    title: "Confraternização Universal",
  },
];

const BY_YEAR: Record<number, readonly BrFederalObservance[]> = {
  2026: BR_FEDERAL_OBSERVANCES_2026,
  2027: BR_FEDERAL_OBSERVANCES_2027_MIN,
};

export function getOfficialFederalObservancesForYear(
  year: number
): readonly BrFederalObservance[] {
  return BY_YEAR[year] ?? [];
}

export function getOfficialObservanceForDay(
  ymd: string,
  year: number
): BrFederalObservance | undefined {
  return getOfficialFederalObservancesForYear(year).find((o) => o.ymd === ymd);
}
