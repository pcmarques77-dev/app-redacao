import { PAUTA_STATUSES, type PautaStatus } from "@/lib/pautas-shared";

export const EDITORIA_OPTIONS: string[] = [
  "Cultura e Lazer",
  "Dinheiro",
  "Estilo de Vida",
  "Saúde e Bem Estar",
  "Tecnologia",
  "Cidadania e Direitos",
  "Carreira e Educação",
  "Últimas Notícias",
];

export const STATUS_OPTIONS: { value: PautaStatus; label: string }[] =
  PAUTA_STATUSES.map((value) => ({ value, label: value }));
