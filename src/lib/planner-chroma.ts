/**
 * Cores do planejador de plantões.
 */

export type PlannerUserChroma = { bg: string; border: string };

/** Cartões de cada dia na grade (amarelo claro). */
export const PLANNER_DAY_CARD: PlannerUserChroma = {
  bg: "hsl(50 88% 94%)",
  border: "hsl(46 36% 76%)",
};

/** Chips de plantão na grade — azul claro sólido (nome na lista). */
export const PLANNER_JOURNALIST_CHIP: PlannerUserChroma = {
  bg: "hsl(214 58% 96%)",
  border: "hsl(214 32% 82%)",
};

/** Cabeçalhos «Semana …» — cores distintas que rotacionam por bloco. */
const WEEK_HEADER_VARIANTS: readonly PlannerUserChroma[] = [
  { bg: "hsl(205 52% 91%)", border: "hsl(205 38% 76%)" },
  { bg: "hsl(145 44% 90%)", border: "hsl(145 34% 74%)" },
  { bg: "hsl(38 58% 91%)", border: "hsl(38 42% 76%)" },
  { bg: "hsl(280 40% 92%)", border: "hsl(280 32% 78%)" },
  { bg: "hsl(12 52% 92%)", border: "hsl(12 40% 78%)" },
  { bg: "hsl(175 42% 90%)", border: "hsl(175 34% 74%)" },
];

export function plannerWeekHeaderSurface(weekIndex: number): PlannerUserChroma {
  return WEEK_HEADER_VARIANTS[weekIndex % WEEK_HEADER_VARIANTS.length]!;
}

/** Área de lista / drop dentro do dia (branco). */
export const PLANNER_SLOT_DROP_SURFACE =
  "bg-white hover:bg-[hsl(210_20%_98%)]";
