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

export const TIPOS_MULTIMIDIA = [
  "Viva Entrevista",
  "Viva Compartilha",
  "Viva Responde",
  "Carrossel",
] as const;

export type TipoMultimidia = (typeof TIPOS_MULTIMIDIA)[number];

const TIPO_MULTIMIDIA_SET = new Set<string>(TIPOS_MULTIMIDIA);

export function isTipoMultimidia(value: string): value is TipoMultimidia {
  return TIPO_MULTIMIDIA_SET.has(value);
}

/** Mantém só formatos conhecidos, na ordem fixa das opções do formulário. */
export function coerceTiposMultimidia(value: unknown): TipoMultimidia[] {
  if (!Array.isArray(value)) return [];
  const found = new Set<TipoMultimidia>();
  for (const item of value) {
    if (typeof item === "string" && isTipoMultimidia(item)) found.add(item);
  }
  return TIPOS_MULTIMIDIA.filter((tipo) => found.has(tipo));
}

export function parseTiposMultimidia(
  value: unknown
): { ok: true; tipos: TipoMultimidia[] } | { ok: false; error: string } {
  if (value == null) return { ok: true, tipos: [] };
  if (!Array.isArray(value)) {
    return { ok: false, error: "Selecione um formato de multimídia válido." };
  }
  for (const item of value) {
    if (typeof item !== "string" || !isTipoMultimidia(item)) {
      return { ok: false, error: "Selecione um formato de multimídia válido." };
    }
  }
  return { ok: true, tipos: coerceTiposMultimidia(value) };
}

/** Liga a demanda ao que foi marcado. Sem formato, a demanda não é gravada. */
export function resolveDemandaMultimidia(input: {
  demanda_multimidia?: boolean;
  tipos_multimidia?: unknown;
}):
  | {
      ok: true;
      demanda_multimidia: boolean;
      tipos_multimidia: TipoMultimidia[];
    }
  | { ok: false; error: string } {
  if (input.demanda_multimidia === false) {
    return { ok: true, demanda_multimidia: false, tipos_multimidia: [] };
  }
  const parsed = parseTiposMultimidia(input.tipos_multimidia);
  if (!parsed.ok) return parsed;
  if (input.demanda_multimidia === true && parsed.tipos.length === 0) {
    return {
      ok: false,
      error: "Selecione ao menos um formato de multimídia.",
    };
  }
  return {
    ok: true,
    demanda_multimidia: parsed.tipos.length > 0,
    tipos_multimidia: parsed.tipos,
  };
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
  tipos_multimidia: TipoMultimidia[];
};

/** Alias semântico para o registro de pauta (`public.pautas`). */
export type Pauta = PautaDashboardRow;

/** Item ativo da fila de hard news (editores). */
export type HardNewsQueueRow = {
  id: string;
  titulo_provisorio: string | null;
  status: PautaStatus;
  reporter_id: string | null;
  data_criacao: string | null;
  reporter: { nome: string | null } | null;
};

export type CreatePautaInput = {
  titulo_provisorio: string;
  fontes?: string | null;
  arquivos_urls?: unknown;
  editoria: string;
  deadline: string;
  status: PautaStatus;
  reporter_id?: string | null;
  demanda_multimidia?: boolean;
  tipos_multimidia?: TipoMultimidia[] | null;
};

export type CreateHardNewsInput = {
  titulo_provisorio: string;
  reporter_id: string;
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
  tipos_multimidia: TipoMultimidia[];
}>;
