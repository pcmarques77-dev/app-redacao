import { PAUTA_STATUSES, type PautaStatus } from "@/lib/pautas-shared";

const EDITORIAS: readonly string[] = [
  "Cultura e Lazer",
  "Dinheiro",
  "Estilo de Vida",
  "Saúde e Bem Estar",
  "Tecnologia",
  "Cidadania e Direitos",
  "Carreira e Educação",
  "Últimas Notícias",
];

export const EDITORIA_OPTIONS: string[] = [...EDITORIAS].sort((a, b) =>
  a.localeCompare(b, "pt-BR")
);

export const STATUS_OPTIONS: { value: PautaStatus; label: string }[] =
  PAUTA_STATUSES.map((value) => ({ value, label: value }));
