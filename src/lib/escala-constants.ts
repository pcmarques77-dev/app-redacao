/** Valores de `escalas.tipo` usados no app e nas Server Actions. */

export const ESCALA_TIPO_FERIADO = "Feriado";
export const ESCALA_TIPO_PLANTAO = "Plantão";
export const ESCALA_TIPO_FERIAS = "Férias";
export const ESCALA_TIPO_STREAMYARD = "Streamyard";
export const ESCALA_TIPO_NOTAS = "Notas";
export const ESCALA_TIPO_AGENDA = "Agenda";

/** Texto da nota pessoal (campo `coordenador` na tabela `escalas`). */
export const NOTA_TEXTO_MAX_LENGTH = 2000;

/** Título do evento de agenda (campo `coordenador`). */
export const AGENDA_TITULO_MAX_LENGTH = 255;

export function normalizeEscalaTipoKey(t: string | null | undefined): string {
  return (t ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function isStreamyardTipo(t: string | null | undefined): boolean {
  return normalizeEscalaTipoKey(t) === "streamyard";
}

export function isNotasTipo(t: string | null | undefined): boolean {
  return normalizeEscalaTipoKey(t) === "notas";
}

export function isAgendaTipo(t: string | null | undefined): boolean {
  return normalizeEscalaTipoKey(t) === "agenda";
}

/** Normaliza o texto da nota pessoal para persistência. */
export function normalizeNotaTexto(
  texto: string | null | undefined
): string | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  if (t.length > NOTA_TEXTO_MAX_LENGTH) return null;
  return t;
}

/** Normaliza título de evento de agenda (`coordenador`). */
export function normalizeAgendaTitulo(
  titulo: string | null | undefined
): string | null {
  const t = (titulo ?? "").trim();
  if (!t) return null;
  if (t.length > AGENDA_TITULO_MAX_LENGTH) return null;
  return t;
}

/** Editoria de agenda persistida em `escalas.horario`. */
export function normalizeAgendaEditoria(
  editoria: string | null | undefined,
  validOptions: readonly string[]
): string | null {
  const t = (editoria ?? "").trim();
  if (!t) return null;
  const valid = new Set(validOptions);
  if (!valid.has(t)) return null;
  return t;
}

/** Normaliza horário salvo (ex.: `8h`, `08:30`) para `HH:MM` usado em `<input type="time">`. */
export function normalizeHorarioForTimeInput(
  stored: string | null | undefined
): string {
  const raw = (stored ?? "").trim();
  if (!raw) return "";
  const first = raw.split(/\s*[–—-]\s*/)[0]?.trim() ?? raw;
  const br = first.match(/^(\d{1,2})h(?:(\d{2}))?$/i);
  if (br) {
    const h = parseInt(br[1] ?? "0", 10);
    const min = br[2] ? parseInt(br[2], 10) : 0;
    if (h > 23 || min > 59) return "";
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  const iso = first.match(/^(\d{1,2}):(\d{2})$/);
  if (iso) {
    const h = parseInt(iso[1] ?? "0", 10);
    const min = parseInt(iso[2] ?? "0", 10);
    if (h > 23 || min > 59) return "";
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  return "";
}

/** Valida e normaliza horário Streamyard para persistência (`HH:MM`). */
export function normalizeStreamyardHorario(
  horario: string | null | undefined
): string | null {
  const normalized = normalizeHorarioForTimeInput(horario);
  return normalized || null;
}
