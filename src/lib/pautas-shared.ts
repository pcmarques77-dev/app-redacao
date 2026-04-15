/** Mensagem retornada pelas server actions quando o repórter tenta alterar pauta alheia. */
export const PAUTA_ACCESS_DENIED =
  "Acesso negado. Você só pode alterar as suas próprias pautas.";

export const PAUTA_STATUSES = [
  "Sugerida",
  "Em produção",
  "Pronto",
  "Publicada",
] as const;

export type PautaStatus = (typeof PAUTA_STATUSES)[number];

const PAUTA_STATUS_SET = new Set<string>(PAUTA_STATUSES);

export function isPautaStatus(value: string): value is PautaStatus {
  return PAUTA_STATUS_SET.has(value);
}

/** Garante um dos quatro status válidos (valores desconhecidos viram Sugerida). */
export function coercePautaStatus(value: string | null | undefined): PautaStatus {
  const v = (value ?? "").trim();
  return isPautaStatus(v) ? v : "Sugerida";
}

export type PautaDashboardRow = {
  id: string;
  titulo_provisorio: string | null;
  editoria: string | null;
  deadline: string | null;
  status: PautaStatus;
  reporter_id: string | null;
  reporter: { nome: string | null } | null;
  demanda_multimidia: boolean;
};

/** Alias semântico para o registro de pauta (`public.pautas`). */
export type Pauta = PautaDashboardRow;

export type CreatePautaInput = {
  titulo_provisorio: string;
  fontes?: string | null;
  arquivos_urls?: unknown;
  editoria: string;
  deadline: string;
  status: PautaStatus;
  reporter_id?: string | null;
  demanda_multimidia?: boolean;
};

export type UpdatePautaPatch = Partial<{
  titulo_provisorio: string;
  fontes: string | null;
  arquivos_urls: unknown;
  editoria: string;
  deadline: string;
  status: PautaStatus;
  reporter_id: string;
  demanda_multimidia: boolean;
}>;
