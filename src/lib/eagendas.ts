import type { SupabaseClient } from "@supabase/supabase-js";

const API_BASE = "https://eagendas.cgu.gov.br/api/v2";
const ROSTER_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const RECENT_SYNC_MAX_AGE_MS = 30 * 60 * 1000;
const FETCH_CONCURRENCY = 5;
const PAGE_CAP = 20;

/** Agente citado no plano (ministro da Integração). Entra se o cargo for de ministro de Estado. */
const MIDR_APO_ID = "15618";

export type AgendaMinistroCard = {
  id: string;
  cguTipo: "compromisso" | "viagem" | "afastamento";
  cguId: string;
  ministroNome: string;
  cargo: string | null;
  orgao: string | null;
  tipoRegistro: string;
  assunto: string;
  local: string | null;
  participantes: string | null;
  dataInicio: string;
  dataFim: string;
  horaInicio: string | null;
  horaFim: string | null;
  url: string | null;
};

type Ministro = {
  apoId: string;
  nome: string;
  cargo: string;
  orgaoId: string;
  orgaoNome: string;
};

type CguTipo = AgendaMinistroCard["cguTipo"];

type AgendaRowInsert = {
  cgu_tipo: CguTipo;
  cgu_id: string;
  apo_id: string;
  ministro_nome: string;
  cargo: string | null;
  orgao: string | null;
  tipo_registro: string;
  assunto: string;
  local: string | null;
  participantes: string | null;
  data_inicio: string;
  data_fim: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  url: string | null;
  updated_at: string;
};

export function eagendasTokenConfigured(): boolean {
  return Boolean(process.env.EAGENDAS_API_TOKEN?.trim());
}

export function isOrgaoMinisterio(nome: string): boolean {
  const n = fold(nome);
  return n.startsWith("ministerio ") || n === "ministerio";
}

export function isCargoMinistroDeEstado(descricao: string): boolean {
  return fold(descricao).startsWith("ministro de estado");
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t || null;
}

function pickText(
  row: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = row[key];
    const found = text(value);
    if (found) return found;
    if (isRecord(value)) {
      const nested = text(
        value.descricao ?? value.nome ?? value.nombre ?? value.cargo
      );
      if (nested) return nested;
    }
  }
  return null;
}

function respostaOf(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) return {};
  return isRecord(payload.resposta) ? payload.resposta : payload;
}

function extractList(payload: unknown, key: string): Record<string, unknown>[] {
  const raw = respostaOf(payload)[key];
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord);
}

function lastPage(payload: unknown): number {
  const resposta = respostaOf(payload);
  const raw =
    resposta.ultima_pagina ??
    resposta.last_page ??
    resposta.total_paginas ??
    resposta.total_pages;
  const n = typeof raw === "number" ? raw : Number(text(raw) ?? "1");
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), PAGE_CAP);
}

function parseYmd(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{2})[/.-](\d{2})[/.-](\d{4})/.exec(raw);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function parseHora(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const m = /(\d{1,2}):(\d{2})/.exec(raw);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

function participantesText(value: unknown): string | null {
  if (typeof value === "string") return text(value);
  if (!Array.isArray(value)) return null;
  const names = value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (!isRecord(item)) return "";
      return (
        pickText(item, [
          "nome",
          "name",
          "participante",
          "nome_participante",
          "razao_social",
        ]) ?? ""
      );
    })
    .filter((name) => name.length > 0);
  return names.length > 0 ? names.join("; ") : null;
}

function tipoLabel(raw: string | null, fallback: string): string {
  const key = fold(raw ?? "");
  if (key.includes("audiencia publica")) return "Audiência pública";
  if (key.includes("audiencia")) return "Audiência";
  if (key.includes("reuniao")) return "Reunião";
  if (key.includes("evento")) return "Evento";
  if (key.includes("viagem")) return "Viagem";
  if (key.includes("afastamento")) return "Afastamento";
  return raw?.trim() || fallback;
}

function toApiDate(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}-${m}-${y}`;
}

function yyyyMm(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function monthBounds(periodo: string): { start: string; end: string } {
  const [y, m] = periodo.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(last).padStart(2, "0")}`,
  };
}

function monthsOverlapping(rangeStart: string, rangeEnd: string): string[] {
  const start = /^(\d{4})-(\d{2})/.exec(rangeStart);
  const end = /^(\d{4})-(\d{2})/.exec(rangeEnd);
  if (!start || !end) return [];
  let year = Number(start[1]);
  let month = Number(start[2]) - 1;
  const endYear = Number(end[1]);
  const endMonth = Number(end[2]) - 1;
  const out: string[] = [];
  while (year < endYear || (year === endYear && month <= endMonth)) {
    out.push(yyyyMm(year, month));
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    if (out.length > 24) break;
  }
  return out;
}

function previousPeriodo(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return yyyyMm(d.getFullYear(), d.getMonth());
}

function publicAgendaUrl(orgaoId: string, apoId: string): string {
  const q = new URLSearchParams({
    filtro_orgaos_ativos: "on",
    filtro_orgao: orgaoId,
    filtro_apos_ativos: "on",
    filtro_servidor: apoId,
  });
  return `https://eagendas.cgu.gov.br/?${q.toString()}#divcalendar`;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        out[index] = await fn(items[index]);
      }
    }
  );
  await Promise.all(workers);
  return out;
}

async function apiGet(
  path: string,
  query: Record<string, string>
): Promise<unknown | null> {
  const token = process.env.EAGENDAS_API_TOKEN?.trim();
  if (!token) return null;
  const url = new URL(`${API_BASE}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(query)) {
    if (value) url.searchParams.set(key, value);
  }
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.error(`e-Agendas ${res.status} ${url.pathname}`);
      return null;
    }
    return (await res.json()) as unknown;
  } catch (error) {
    console.error("e-Agendas", path, error);
    return null;
  }
}

async function apiList(
  path: string,
  listKey: string,
  query: Record<string, string>
): Promise<Record<string, unknown>[] | null> {
  const first = await apiGet(path, query);
  if (!first) return null;
  const rows = extractList(first, listKey);
  const pages = lastPage(first);
  if (pages <= 1) return rows;
  const rest = await mapPool(
    Array.from({ length: pages - 1 }, (_, i) => i + 2),
    FETCH_CONCURRENCY,
    (pagina) => apiGet(path, { ...query, pagina: String(pagina) })
  );
  for (const page of rest) {
    if (!page) return null;
    rows.push(...extractList(page, listKey));
  }
  return rows;
}

function ministroFromApo(
  row: Record<string, unknown>,
  fallback: { orgaoId: string; orgaoNome: string; cargo: string }
): Ministro | null {
  const apoId = pickText(row, ["id", "apo_id", "servidor_id"]);
  if (!apoId) return null;
  const situacao = fold(pickText(row, ["situacao", "status"]) ?? "");
  if (situacao.includes("inativ")) return null;
  const nome =
    pickText(row, ["nome", "nome_apo", "nome_servidor", "nome_agente"]) ??
    "Ministro";
  const cargo =
    pickText(row, [
      "cargo",
      "descricao_cargo",
      "cargo_comissao",
      "nome_cargo",
    ]) ?? fallback.cargo;
  return {
    apoId,
    nome,
    cargo,
    orgaoId: pickText(row, ["orgao_id"]) ?? fallback.orgaoId,
    orgaoNome: pickText(row, ["orgao", "orgao_nome", "nome_orgao"]) ?? fallback.orgaoNome,
  };
}

async function discoverMinistros(): Promise<Ministro[] | null> {
  const orgaos = await apiList("orgaos", "orgaos", { situacao: "ativo" });
  if (!orgaos) return null;

  const ministerios = orgaos.filter((orgao) => {
    const nome = pickText(orgao, ["nome", "nombre", "descricao"]) ?? "";
    return isOrgaoMinisterio(nome);
  });

  const found = await mapPool(ministerios, FETCH_CONCURRENCY, async (orgao) => {
    const orgaoId = pickText(orgao, ["id"]);
    const orgaoNome = pickText(orgao, ["nome", "nombre", "descricao"]) ?? "";
    if (!orgaoId) return [] as Ministro[];
    const cargos = await apiList("cargos-comissionados", "cargos_comissionados", {
      orgao_id: orgaoId,
      descricao: "MINISTRO DE ESTADO",
      situacao: "ativo",
    });
    if (!cargos) return null;
    const ministros: Ministro[] = [];
    for (const cargo of cargos) {
      const descricao =
        pickText(cargo, ["descricao", "nome", "cargo"]) ?? "";
      if (!isCargoMinistroDeEstado(descricao)) continue;
      const cargoId = pickText(cargo, ["id"]);
      if (!cargoId) continue;
      const apos = await apiList(
        "agentes-publicos-obrigados",
        "agentes_publicos_obrigados",
        {
          orgao_id: orgaoId,
          cargo_comissao_id: cargoId,
          situacao: "ativo",
        }
      );
      if (!apos) return null;
      for (const apo of apos) {
        const ministro = ministroFromApo(apo, {
          orgaoId,
          orgaoNome,
          cargo: descricao,
        });
        if (ministro && isCargoMinistroDeEstado(ministro.cargo)) {
          ministros.push(ministro);
        }
      }
    }
    return ministros;
  });

  if (found.some((item) => item === null)) return null;
  const byId = new Map<string, Ministro>();
  for (const group of found) {
    if (!group) continue;
    for (const ministro of group) byId.set(ministro.apoId, ministro);
  }

  if (!byId.has(MIDR_APO_ID)) {
    const one = await apiGet(`agentes-publicos-obrigados/${MIDR_APO_ID}`, {});
    const body = one ? respostaOf(one) : null;
    const listed = one ? extractList(one, "agentes_publicos_obrigados")[0] : undefined;
    const agente = body && isRecord(body.agente) ? body.agente : null;
    const row =
      listed ??
      agente ??
      (body && pickText(body, ["id"]) ? body : null);
    if (isRecord(row)) {
      const ministro = ministroFromApo(row, {
        orgaoId: pickText(row, ["orgao_id"]) ?? "1393",
        orgaoNome:
          pickText(row, ["orgao", "orgao_nome", "nome_orgao"]) ??
          "Ministério da Integração e do Desenvolvimento Regional",
        cargo: "",
      });
      if (ministro && isCargoMinistroDeEstado(ministro.cargo)) {
        byId.set(ministro.apoId, ministro);
      }
    }
  }

  return [...byId.values()];
}

async function readRoster(
  admin: SupabaseClient
): Promise<{ ministros: Ministro[]; atualizadoEm: string | null } | null> {
  const { data, error } = await admin
    .from("agendas_ministros_roster")
    .select("ministros, atualizado_em")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    console.error(error.message);
    return null;
  }
  const ministros = Array.isArray(data?.ministros)
    ? (data.ministros as Ministro[]).filter(
        (item) => item && typeof item.apoId === "string" && item.apoId
      )
    : [];
  return {
    ministros,
    atualizadoEm:
      typeof data?.atualizado_em === "string" ? data.atualizado_em : null,
  };
}

async function ministrosAtuais(
  admin: SupabaseClient
): Promise<Ministro[] | null> {
  const cached = await readRoster(admin);
  if (!cached) return null;
  const age = cached.atualizadoEm
    ? Date.now() - new Date(cached.atualizadoEm).getTime()
    : Number.POSITIVE_INFINITY;
  if (cached.ministros.length > 0 && age < ROSTER_MAX_AGE_MS) {
    return cached.ministros;
  }
  const fresh = await discoverMinistros();
  if (!fresh) return cached.ministros.length > 0 ? cached.ministros : null;
  if (fresh.length === 0) {
    return cached.ministros.length > 0 ? cached.ministros : [];
  }
  const { error } = await admin.from("agendas_ministros_roster").upsert(
    {
      id: 1,
      ministros: fresh,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) console.error(error.message);
  return fresh;
}

function assuntoOf(
  row: Record<string, unknown>,
  tipo: CguTipo
): string {
  const direto = pickText(row, [
    "assunto",
    "titulo",
    "título",
    "nome",
    "descricao",
    "objetivo",
  ]);
  if (direto) return direto;
  if (tipo === "viagem") {
    const origem = pickText(row, ["origem", "cidade_origem"]);
    const destino = pickText(row, ["destino", "cidade_destino"]);
    if (origem || destino) {
      return `Viagem: ${origem ?? "—"} → ${destino ?? "—"}`;
    }
    return "Viagem";
  }
  if (tipo === "afastamento") {
    return pickText(row, ["motivo", "detalhamento"]) ?? "Afastamento";
  }
  return "Compromisso";
}

function rowFromApi(
  row: Record<string, unknown>,
  tipo: CguTipo,
  ministro: Ministro
): AgendaRowInsert | null {
  const cguId = pickText(row, ["id"]);
  const dataInicio = parseYmd(
    row.data_inicio ?? row.data_inicial ?? row.inicio
  );
  if (!cguId || !dataInicio) return null;
  const dataFim =
    parseYmd(row.data_termino ?? row.data_fim ?? row.termino) ?? dataInicio;
  const tipoRegistro = tipoLabel(
    pickText(row, [
      "tipo_compromisso",
      "tipo_compromisso_com_acentuacao",
      "tipo",
      "tipo_registro",
    ]),
    tipo === "viagem"
      ? "Viagem"
      : tipo === "afastamento"
        ? "Afastamento"
        : "Compromisso"
  );
  return {
    cgu_tipo: tipo,
    cgu_id: cguId,
    apo_id: ministro.apoId,
    ministro_nome: ministro.nome,
    cargo: ministro.cargo || null,
    orgao: ministro.orgaoNome || null,
    tipo_registro: tipoRegistro,
    assunto: assuntoOf(row, tipo).slice(0, 500),
    local: pickText(row, ["local", "local_compromisso", "endereco"]),
    participantes: participantesText(
      row.participantes ?? row.participante ?? row.lista_participantes
    ),
    data_inicio: dataInicio,
    data_fim: dataFim < dataInicio ? dataInicio : dataFim,
    hora_inicio: parseHora(row.hora_inicio ?? row.horario_inicio ?? row.inicio_hora),
    hora_fim: parseHora(row.hora_termino ?? row.hora_fim ?? row.horario_fim),
    url: publicAgendaUrl(ministro.orgaoId, ministro.apoId),
    updated_at: new Date().toISOString(),
  };
}

async function registrosDoMinistro(
  ministro: Ministro,
  start: string,
  end: string
): Promise<AgendaRowInsert[] | null> {
  const query = {
    apo_id: ministro.apoId,
    data_inicio: toApiDate(start),
    data_termino: toApiDate(end),
  };
  const [compromissos, viagens, afastamentos] = await Promise.all([
    apiList("compromissos", "compromissos", query),
    apiList("viagens", "viagens", query),
    apiList("afastamentos", "afastamentos", query),
  ]);
  if (!compromissos || !viagens || !afastamentos) return null;
  const rows: AgendaRowInsert[] = [];
  for (const item of compromissos) {
    const mapped = rowFromApi(item, "compromisso", ministro);
    if (mapped) rows.push(mapped);
  }
  for (const item of viagens) {
    const mapped = rowFromApi(item, "viagem", ministro);
    if (mapped) rows.push(mapped);
  }
  for (const item of afastamentos) {
    const mapped = rowFromApi(item, "afastamento", ministro);
    if (mapped) rows.push(mapped);
  }
  return rows;
}

async function upsertRows(
  admin: SupabaseClient,
  rows: AgendaRowInsert[]
): Promise<boolean> {
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await admin
      .from("agendas_ministros")
      .upsert(chunk, { onConflict: "cgu_tipo,cgu_id" });
    if (error) {
      console.error(error.message);
      return false;
    }
  }
  return true;
}

async function syncPeriodo(
  admin: SupabaseClient,
  periodo: string,
  ministros: Ministro[]
): Promise<boolean> {
  const { start, end } = monthBounds(periodo);
  const groups = await mapPool(ministros, FETCH_CONCURRENCY, (ministro) =>
    registrosDoMinistro(ministro, start, end)
  );
  if (groups.some((group) => group === null)) return false;
  const byKey = new Map<string, AgendaRowInsert>();
  for (const group of groups) {
    for (const row of group ?? []) {
      byKey.set(`${row.cgu_tipo}:${row.cgu_id}`, row);
    }
  }
  const saved = await upsertRows(admin, [...byKey.values()]);
  if (!saved) return false;
  const { error } = await admin.from("agendas_ministros_sync").upsert(
    { periodo, sincronizado_em: new Date().toISOString() },
    { onConflict: "periodo" }
  );
  if (error) {
    console.error(error.message);
    return false;
  }
  return true;
}

/**
 * Atualiza o mês visível quando precisa.
 * Mês atual, o anterior e meses futuros: de novo após 30 minutos.
 * Mês mais antigo: só na primeira abertura.
 * Não apaga linhas se a CGU deixar de devolver o registro.
 */
export async function syncAgendasMinistrosForRange(
  admin: SupabaseClient,
  rangeStart: string,
  rangeEnd: string,
  force = false
): Promise<void> {
  if (!eagendasTokenConfigured()) return;

  const now = new Date();
  const current = yyyyMm(now.getFullYear(), now.getMonth());
  const previous = previousPeriodo(current);
  const visible = new Set(monthsOverlapping(rangeStart, rangeEnd));
  if (visible.has(current)) visible.add(previous);

  const { data: stamps, error } = await admin
    .from("agendas_ministros_sync")
    .select("periodo, sincronizado_em")
    .in("periodo", [...visible]);
  if (error) {
    console.error(error.message);
    return;
  }
  const syncedAt = new Map<string, number>();
  for (const row of stamps ?? []) {
    const periodo = text(row.periodo);
    const at = text(row.sincronizado_em);
    if (periodo && at) syncedAt.set(periodo, new Date(at).getTime());
  }

  const due = [...visible].filter((periodo) => {
    if (force) return true;
    const at = syncedAt.get(periodo);
    const recent = periodo >= previous;
    if (at == null) return true;
    if (!recent) return false;
    return Date.now() - at >= RECENT_SYNC_MAX_AGE_MS;
  });
  if (due.length === 0) return;

  const ministros = await ministrosAtuais(admin);
  if (!ministros || ministros.length === 0) return;

  for (const periodo of due) {
    await syncPeriodo(admin, periodo, ministros);
  }
}

export async function listAgendasMinistrosInRange(
  admin: SupabaseClient,
  rangeStart: string,
  rangeEnd: string
): Promise<AgendaMinistroCard[]> {
  const { data, error } = await admin
    .from("agendas_ministros")
    .select(
      "id, cgu_tipo, cgu_id, ministro_nome, cargo, orgao, tipo_registro, assunto, local, participantes, data_inicio, data_fim, hora_inicio, hora_fim, url"
    )
    .lte("data_inicio", rangeEnd)
    .gte("data_fim", rangeStart)
    .order("data_inicio", { ascending: true });
  if (error) {
    console.error(error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    cguTipo: row.cgu_tipo as CguTipo,
    cguId: String(row.cgu_id),
    ministroNome: String(row.ministro_nome ?? "Ministro"),
    cargo: text(row.cargo),
    orgao: text(row.orgao),
    tipoRegistro: String(row.tipo_registro ?? "Compromisso"),
    assunto: String(row.assunto ?? "Compromisso"),
    local: text(row.local),
    participantes: text(row.participantes),
    dataInicio: String(row.data_inicio).slice(0, 10),
    dataFim: String(row.data_fim ?? row.data_inicio).slice(0, 10),
    horaInicio: text(row.hora_inicio),
    horaFim: text(row.hora_fim),
    url: text(row.url),
  }));
}

export async function loadAgendasMinistros(
  admin: SupabaseClient,
  rangeStart: string,
  rangeEnd: string,
  force = false
): Promise<AgendaMinistroCard[]> {
  try {
    await syncAgendasMinistrosForRange(admin, rangeStart, rangeEnd, force);
  } catch (error) {
    console.error(error);
  }
  try {
    return await listAgendasMinistrosInRange(admin, rangeStart, rangeEnd);
  } catch (error) {
    console.error(error);
    return [];
  }
}
