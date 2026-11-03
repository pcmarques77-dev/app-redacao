import { isNotasTipo, normalizeEscalaTipoKey } from "@/lib/escala-constants";
import { parseDeadlineToYmd } from "@/lib/deadline-date";
import {
  coercePautaStatus,
  type HardNewsQueueRow,
  type PautaDashboardRow,
  type PautaStatus,
} from "@/lib/pautas-shared";

export type RealtimeEscalaRow = {
  id: string;
  tipo: string | null;
  usuario_id: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  coordenador: string | null;
  horario: string | null;
  usuarios: { nome: string | null } | null;
};

export type UsuarioNome = { id: string; nome: string | null };

export type RowChange = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

const HARD_NEWS_QUEUE_STATUSES = new Set<PautaStatus>([
  "Em produção",
  "Pronto",
  "Publicada",
]);

export function asRowChange(payload: {
  eventType?: string;
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
}): RowChange | null {
  if (
    payload.eventType !== "INSERT" &&
    payload.eventType !== "UPDATE" &&
    payload.eventType !== "DELETE"
  ) {
    return null;
  }
  return {
    eventType: payload.eventType,
    new: payload.new ?? {},
    old: payload.old ?? {},
  };
}

function rowId(change: RowChange): string | null {
  const source = change.eventType === "DELETE" ? change.old : change.new;
  const id = source.id ?? change.old.id;
  return typeof id === "string" && id.trim() ? id : null;
}

function nullableString(
  raw: Record<string, unknown>,
  key: string
): string | null | undefined {
  if (!(key in raw)) return undefined;
  const value = raw[key];
  if (value == null) return null;
  return typeof value === "string" ? value : undefined;
}

function isPersonCard(tipo: string | null): boolean {
  const key = normalizeEscalaTipoKey(tipo);
  return key === "plantao" || key === "ferias" || key === "streamyard";
}

function reporterFromUsers(
  reporterId: string | null,
  users: UsuarioNome[],
  previous: PautaDashboardRow | undefined
): { nome: string | null } | null {
  if (!reporterId) return null;
  const known = users.find((user) => user.id === reporterId);
  if (known) return { nome: known.nome };
  if (previous?.reporter_id === reporterId) return previous.reporter;
  return null;
}

function mapPautaRecord(
  raw: Record<string, unknown>,
  users: UsuarioNome[],
  previous: PautaDashboardRow | undefined
): PautaDashboardRow | null {
  if (typeof raw.id !== "string" || !raw.id) return null;
  const titulo = nullableString(raw, "titulo_provisorio");
  const editoria = nullableString(raw, "editoria");
  const deadline = nullableString(raw, "deadline");
  const statusRaw = nullableString(raw, "status");
  const reporterRaw = nullableString(raw, "reporter_id");
  if (
    titulo === undefined ||
    editoria === undefined ||
    deadline === undefined ||
    reporterRaw === undefined
  ) {
    return null;
  }
  if (statusRaw === undefined && !previous) return null;

  const demanda = raw.demanda_multimidia;
  const demandaMultimidia =
    demanda === true || demanda === false
      ? demanda
      : (previous?.demanda_multimidia ?? false);

  return {
    id: raw.id,
    titulo_provisorio: titulo,
    editoria,
    deadline,
    status: coercePautaStatus(statusRaw ?? previous?.status),
    reporter_id: reporterRaw,
    reporter: reporterFromUsers(reporterRaw, users, previous),
    demanda_multimidia: demandaMultimidia,
  };
}

function inDeadlineWindow(
  deadline: string | null,
  rangeStart: string,
  rangeEnd: string
): boolean {
  const ymd = parseDeadlineToYmd(deadline);
  if (!ymd) return false;
  return ymd >= rangeStart && ymd <= rangeEnd;
}

/** Pautas do calendário: entra só quem está no intervalo visível. */
export function applyCalendarPautaChange(
  rows: PautaDashboardRow[],
  change: RowChange,
  users: UsuarioNome[],
  range: { rangeStart: string; rangeEnd: string }
): { ok: true; rows: PautaDashboardRow[] } | { ok: false } {
  const id = rowId(change);
  if (!id) return { ok: false };

  if (change.eventType === "DELETE") {
    return { ok: true, rows: rows.filter((row) => row.id !== id) };
  }

  if (typeof change.new.hard_news !== "boolean") return { ok: false };
  if (change.new.hard_news) {
    return { ok: true, rows: rows.filter((row) => row.id !== id) };
  }

  const previous = rows.find((row) => row.id === id);
  const mapped = mapPautaRecord(change.new, users, previous);
  if (!mapped) return { ok: false };

  const without = rows.filter((row) => row.id !== id);
  if (!inDeadlineWindow(mapped.deadline, range.rangeStart, range.rangeEnd)) {
    return { ok: true, rows: without };
  }
  return { ok: true, rows: [...without, mapped] };
}

export type ListPautaFilter = {
  filtroReporter: string;
  filtroEditoria: string;
  reporterNome: (row: PautaDashboardRow) => string;
};

function matchesListFilter(row: PautaDashboardRow, filter: ListPautaFilter): boolean {
  if (filter.filtroReporter !== "Todos") {
    const nome = filter.reporterNome(row);
    if (nome === "—" || nome !== filter.filtroReporter) return false;
  }
  if (filter.filtroEditoria !== "Todos") {
    const editoria = row.editoria?.trim() ?? "";
    if (!editoria || editoria !== filter.filtroEditoria) return false;
  }
  return true;
}

/**
 * Lista paginada. Atualiza linhas já carregadas.
 * Insert fora da página pede recarga (`ok: false`) só se a lista já foi buscada.
 */
export function applyListPautaChange(
  rows: PautaDashboardRow[],
  change: RowChange,
  users: UsuarioNome[],
  filter: ListPautaFilter,
  listActive: boolean
): { ok: true; rows: PautaDashboardRow[]; totalDelta: number } | { ok: false } {
  const id = rowId(change);
  if (!id) return { ok: false };

  const previous = rows.find((row) => row.id === id);

  if (change.eventType === "DELETE") {
    if (!previous) return { ok: true, rows, totalDelta: 0 };
    return {
      ok: true,
      rows: rows.filter((row) => row.id !== id),
      totalDelta: -1,
    };
  }

  if (typeof change.new.hard_news !== "boolean") return { ok: false };
  if (change.new.hard_news) {
    if (!previous) return { ok: true, rows, totalDelta: 0 };
    return {
      ok: true,
      rows: rows.filter((row) => row.id !== id),
      totalDelta: -1,
    };
  }

  const mapped = mapPautaRecord(change.new, users, previous);
  if (!mapped) return { ok: false };

  const matches = matchesListFilter(mapped, filter);
  if (previous && matches) {
    return {
      ok: true,
      rows: rows.map((row) => (row.id === id ? mapped : row)),
      totalDelta: 0,
    };
  }
  if (previous && !matches) {
    return {
      ok: true,
      rows: rows.filter((row) => row.id !== id),
      totalDelta: -1,
    };
  }
  if (!matches || !listActive) {
    return { ok: true, rows, totalDelta: 0 };
  }
  return { ok: false };
}

function escalaOverlaps(
  dataInicio: string | null,
  dataFim: string | null,
  rangeStart: string,
  rangeEnd: string
): boolean {
  if (!dataInicio) return false;
  if (dataInicio >= rangeStart && dataInicio <= rangeEnd) return true;
  return dataInicio < rangeStart && dataFim != null && dataFim >= rangeStart;
}

export function applyEscalaChange(
  rows: RealtimeEscalaRow[],
  change: RowChange,
  viewerId: string,
  users: UsuarioNome[],
  range: { rangeStart: string; rangeEnd: string }
): { ok: true; rows: RealtimeEscalaRow[] } | { ok: false } {
  const id = rowId(change);
  if (!id) return { ok: false };

  if (change.eventType === "DELETE") {
    return { ok: true, rows: rows.filter((row) => row.id !== id) };
  }

  const tipo = nullableString(change.new, "tipo");
  const usuarioId = nullableString(change.new, "usuario_id");
  const dataInicio = nullableString(change.new, "data_inicio");
  const dataFim = nullableString(change.new, "data_fim");
  const coordenador = nullableString(change.new, "coordenador");
  const horario = nullableString(change.new, "horario");
  if (
    tipo === undefined ||
    usuarioId === undefined ||
    dataInicio === undefined ||
    dataFim === undefined ||
    coordenador === undefined ||
    horario === undefined
  ) {
    return { ok: false };
  }

  const previous = rows.find((row) => row.id === id);
  const without = rows.filter((row) => row.id !== id);

  if (isNotasTipo(tipo)) {
    if (!viewerId) return { ok: false };
    if (usuarioId !== viewerId) return { ok: true, rows: without };
  }

  if (
    !escalaOverlaps(
      dataInicio,
      dataFim,
      range.rangeStart,
      range.rangeEnd
    )
  ) {
    return { ok: true, rows: without };
  }

  let usuarios = previous?.usuarios ?? null;
  if (usuarioId) {
    const known = users.find((user) => user.id === usuarioId);
    if (known) {
      usuarios = { nome: known.nome };
    } else if (!previous && isPersonCard(tipo)) {
      return { ok: false };
    } else if (!previous) {
      usuarios = null;
    }
  } else {
    usuarios = null;
  }

  const next: RealtimeEscalaRow = {
    id,
    tipo,
    usuario_id: usuarioId,
    data_inicio: dataInicio,
    data_fim: dataFim,
    coordenador,
    horario,
    usuarios,
  };
  return { ok: true, rows: [...without, next] };
}

export function applyHardNewsChange(
  rows: HardNewsQueueRow[],
  change: RowChange,
  users: UsuarioNome[]
): { ok: true; rows: HardNewsQueueRow[] } | { ok: false } {
  const id = rowId(change);
  if (!id) return { ok: false };

  if (change.eventType === "DELETE") {
    return { ok: true, rows: rows.filter((row) => row.id !== id) };
  }

  if (typeof change.new.hard_news !== "boolean") return { ok: false };
  const without = rows.filter((row) => row.id !== id);
  if (!change.new.hard_news) return { ok: true, rows: without };

  const previous = rows.find((row) => row.id === id);
  const titulo = nullableString(change.new, "titulo_provisorio");
  const statusRaw = nullableString(change.new, "status");
  const reporterRaw = nullableString(change.new, "reporter_id");
  const created = nullableString(change.new, "data_criacao");
  if (titulo === undefined || reporterRaw === undefined) return { ok: false };
  if (statusRaw === undefined && !previous) return { ok: false };

  const status = coercePautaStatus(statusRaw ?? previous?.status);
  if (!HARD_NEWS_QUEUE_STATUSES.has(status)) {
    return { ok: true, rows: without };
  }

  let reporter = previous?.reporter ?? null;
  if (!reporterRaw) {
    reporter = null;
  } else {
    const known = users.find((user) => user.id === reporterRaw);
    if (known) reporter = { nome: known.nome };
    else if (previous?.reporter_id !== reporterRaw) reporter = null;
  }

  const next: HardNewsQueueRow = {
    id,
    titulo_provisorio: titulo,
    status,
    reporter_id: reporterRaw,
    data_criacao:
      created === undefined ? (previous?.data_criacao ?? null) : created,
    reporter,
  };
  return { ok: true, rows: [next, ...without] };
}
