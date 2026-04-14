/** Mensagem retornada pelas server actions quando o repórter tenta alterar pauta alheia. */
export const PAUTA_ACCESS_DENIED =
  "Acesso negado. Você só pode alterar as suas próprias pautas.";

export type PautaDashboardRow = {
  id: string;
  titulo_provisorio: string | null;
  editoria: string | null;
  deadline: string | null;
  status: string | null;
  reporter_id: string | null;
  reporter: { nome: string | null } | null;
};

export type CreatePautaInput = {
  titulo_provisorio: string;
  fontes?: string | null;
  arquivos_urls?: unknown;
  editoria: string;
  deadline: string;
  status: string;
  reporter_id?: string | null;
};

export type UpdatePautaPatch = Partial<{
  titulo_provisorio: string;
  fontes: string | null;
  arquivos_urls: unknown;
  editoria: string;
  deadline: string;
  status: string;
  reporter_id: string;
}>;
