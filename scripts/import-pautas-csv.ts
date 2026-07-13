/**
 * Importa pautas de um CSV (exportado do Excel) para `public.pautas`.
 *
 * Colunas esperadas: Repórter, Pauta, Editoria, Data (DD/MM/AAAA), Status (opcional).
 *
 * Uso:
 *   npm run pautas:import -- data/sugestoes-pauta.csv
 *   npm run pautas:import -- data/sugestoes-pauta.csv --apply
 *
 * Requer: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  PAUTA_STATUSES,
  type PautaStatus,
} from "../src/lib/pautas-shared";

const VALID_EDITORIAS = new Set([
  "Cultura e Lazer",
  "Dinheiro",
  "Estilo de Vida",
  "Saúde e Bem Estar",
  "Tecnologia",
  "Cidadania e Direitos",
  "Carreira e Educação",
  "Últimas Notícias",
]);

const DEFAULT_EDITORIA = "Últimas Notícias";
const DEFAULT_STATUS: PautaStatus = "Sugerida";

/** Rótulos da planilha → enum `status_pauta` do app. */
const STATUS_FROM_SHEET: Record<string, PautaStatus> = {
  "nao iniciada": "Sugerida",
  "não iniciada": "Sugerida",
  "em andamento": "Em produção",
  pronta: "Pronto",
  publicada: "Publicada",
  derrubada: "Sugerida",
  sugerida: "Sugerida",
  "em producao": "Em produção",
  "em produção": "Em produção",
  pronto: "Pronto",
};

function cleanEnvValue(raw: string | undefined): string {
  if (raw == null) return "";
  let s = raw.replace(/\r\n/g, "\n").replace(/\r/g, "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function normalizeNomeKey(nome: string | null | undefined): string {
  return (nome ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n" || (c === "\r" && text[i + 1] === "\n")) {
      if (c === "\r") i += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      continue;
    }
    field += c;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function resolveEditoria(raw: string): { editoria: string; warning?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { editoria: DEFAULT_EDITORIA };
  if (VALID_EDITORIAS.has(trimmed)) return { editoria: trimmed };
  return {
    editoria: DEFAULT_EDITORIA,
    warning: `editoria "${trimmed}" inválida → ${DEFAULT_EDITORIA}`,
  };
}

function normalizeStatusKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function resolveStatus(raw: string): { status: PautaStatus; warning?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { status: DEFAULT_STATUS };

  const direct = trimmed as PautaStatus;
  if ((PAUTA_STATUSES as readonly string[]).includes(direct)) {
    return { status: direct };
  }

  const mapped = STATUS_FROM_SHEET[normalizeStatusKey(trimmed)];
  if (mapped) {
    if (normalizeStatusKey(trimmed) === "derrubada") {
      return {
        status: mapped,
        warning: `status "Derrubada" → ${mapped}`,
      };
    }
    return { status: mapped };
  }

  return {
    status: DEFAULT_STATUS,
    warning: `status "${trimmed}" inválido → ${DEFAULT_STATUS}`,
  };
}

function defaultDeadlineIso(): string {
  const year = new Date().getFullYear();
  return `${year}-12-31T00:00:00+00:00`;
}

function parseDeadlinePtBR(value: string): { deadline: string; warning?: string } {
  const s = value.trim();
  if (!s) {
    return {
      deadline: defaultDeadlineIso(),
      warning: "sem data → 31/12 do ano atual",
    };
  }

  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) {
    return {
      deadline: defaultDeadlineIso(),
      warning: `data "${s}" inválida → 31/12 do ano atual`,
    };
  }

  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return {
      deadline: defaultDeadlineIso(),
      warning: `data "${s}" inválida → 31/12 do ano atual`,
    };
  }

  const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { deadline: `${ymd}T00:00:00+00:00` };
}

function tituloMatchKey(titulo: string, reporterId: string): string {
  return `${reporterId}::${titulo.trim().toLowerCase()}`;
}

type UsuarioRow = { id: string; nome: string | null };

type ParsedRow = {
  line: number;
  reporterNome: string;
  reporterId: string;
  titulo: string;
  editoria: string;
  deadline: string;
  status: PautaStatus;
  warnings: string[];
};

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const apply = args.includes("--apply");
  const csvArg = args.find((a) => !a.startsWith("--"));

  if (!csvArg) {
    console.error("Informe o caminho do CSV. Ex.: data/sugestoes-pauta.csv");
    process.exit(1);
  }

  const csvPath = resolve(process.cwd(), csvArg);
  if (!existsSync(csvPath)) {
    console.error(`Arquivo não encontrado: ${csvPath}`);
    process.exit(1);
  }

  const url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) {
    console.error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ex.: do .env.local)."
    );
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: usuarios, error: usuariosErr } = await admin
    .from("usuarios")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (usuariosErr) {
    console.error("Erro ao listar usuarios:", usuariosErr.message);
    process.exit(1);
  }

  const reporterByNome = new Map<string, string>();
  for (const u of (usuarios ?? []) as UsuarioRow[]) {
    const keyNome = normalizeNomeKey(u.nome);
    if (keyNome) reporterByNome.set(keyNome, u.id);
  }

  const raw = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const matrix = parseCsv(raw);
  if (matrix.length < 2) {
    console.error("CSV vazio ou sem dados.");
    process.exit(1);
  }

  const header = matrix[0].map((h) => h.trim().toLowerCase());
  const idxReporter = header.findIndex((h) => h.includes("repórter") || h.includes("reporter"));
  const idxPauta = header.findIndex((h) => h === "pauta" || h.includes("título") || h.includes("titulo"));
  const idxEditoria = header.findIndex((h) => h.includes("editoria"));
  const idxData = header.findIndex((h) => h === "data" || h.includes("deadline") || h.includes("prazo"));
  const idxStatus = header.findIndex((h) => h === "status");

  if (idxReporter < 0 || idxPauta < 0) {
    console.error(
      "Cabeçalho inválido. Esperado: Repórter, Pauta, Editoria, Data, Status (opcional)"
    );
    process.exit(1);
  }

  const { data: existingRows, error: existingErr } = await admin
    .from("pautas")
    .select("id, titulo_provisorio, reporter_id, status");

  if (existingErr) {
    console.error("Erro ao listar pautas existentes:", existingErr.message);
    process.exit(1);
  }

  const existingByTituloReporter = new Map<
    string,
    { id: string; status: PautaStatus }
  >();
  for (const row of existingRows ?? []) {
    const titulo = String(row.titulo_provisorio ?? "").trim();
    const reporterId = String(row.reporter_id ?? "").trim();
    if (!titulo || !reporterId) continue;
    const status = (row.status as PautaStatus) || DEFAULT_STATUS;
    existingByTituloReporter.set(tituloMatchKey(titulo, reporterId), {
      id: String(row.id),
      status,
    });
  }

  const parsed: ParsedRow[] = [];
  const skipped: { line: number; reason: string }[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const cols = matrix[i];
    const line = i + 1;
    const reporterNome = (cols[idxReporter] ?? "").trim();
    const titulo = (cols[idxPauta] ?? "").trim().replace(/\s+/g, " ");
    const editoriaRaw = idxEditoria >= 0 ? (cols[idxEditoria] ?? "").trim() : "";
    const dataRaw = idxData >= 0 ? (cols[idxData] ?? "").trim() : "";
    const statusRaw = idxStatus >= 0 ? (cols[idxStatus] ?? "").trim() : "";

    if (!reporterNome && !titulo && !editoriaRaw && !dataRaw && !statusRaw) {
      continue;
    }

    if (!titulo) {
      skipped.push({ line, reason: "sem título (Pauta vazia)" });
      continue;
    }
    if (!reporterNome) {
      skipped.push({ line, reason: `sem repórter — "${titulo}"` });
      continue;
    }

    const reporterId = reporterByNome.get(normalizeNomeKey(reporterNome));
    if (!reporterId) {
      skipped.push({ line, reason: `repórter desconhecido — "${reporterNome}"` });
      continue;
    }

    const warnings: string[] = [];
    const { deadline, warning: deadlineWarning } = parseDeadlinePtBR(dataRaw);
    if (deadlineWarning) warnings.push(deadlineWarning);

    const { editoria, warning: editoriaWarning } = resolveEditoria(editoriaRaw);
    if (editoriaWarning) warnings.push(editoriaWarning);

    const { status, warning: statusWarning } = resolveStatus(statusRaw);
    if (statusWarning) warnings.push(statusWarning);

    parsed.push({
      line,
      reporterNome,
      reporterId,
      titulo,
      editoria,
      deadline,
      status,
      warnings,
    });
  }

  console.log(
    apply
      ? "[pautas:import] Inserindo pautas…"
      : "[pautas:import] Modo simulação (adicione --apply para inserir)."
  );
  console.log(`Arquivo: ${csvPath}`);
  console.log(`Linhas válidas: ${parsed.length}`);
  console.log(`Ignoradas: ${skipped.length}`);

  for (const s of skipped) {
    console.log(`  ! linha ${s.line}: ${s.reason}`);
  }

  let ok = 0;
  let fail = 0;
  let updated = 0;
  let skippedExisting = 0;

  for (const row of parsed) {
    const label = `L${row.line} ${row.reporterNome} | ${row.deadline.slice(0, 10)} | ${row.status} | ${row.titulo}`;
    for (const w of row.warnings) {
      console.log(`  ~ ${w} (${label})`);
    }

    const existing = existingByTituloReporter.get(
      tituloMatchKey(row.titulo, row.reporterId)
    );

    if (!apply) {
      if (existing) {
        if (existing.status !== row.status) {
          console.log(`  ↻ atualizaria status: ${existing.status} → ${row.status} (${label})`);
          updated += 1;
        } else {
          console.log(`  = já existe (${label})`);
          skippedExisting += 1;
        }
      } else {
        console.log(`  → ${label}`);
        ok += 1;
      }
      continue;
    }

    if (existing) {
      if (existing.status === row.status) {
        console.log(`  = já existe (${label})`);
        skippedExisting += 1;
        continue;
      }
      const { error } = await admin
        .from("pautas")
        .update({ status: row.status })
        .eq("id", existing.id);
      if (error) {
        console.error(`  ✗ status ${label}: ${error.message}`);
        fail += 1;
        continue;
      }
      console.log(`  ↻ status ${existing.status} → ${row.status} (${label})`);
      updated += 1;
      continue;
    }

    const { error } = await admin.from("pautas").insert({
      titulo_provisorio: row.titulo,
      reporter_id: row.reporterId,
      editoria: row.editoria,
      deadline: row.deadline,
      status: row.status,
      fontes: null,
      arquivos_urls: [],
      demanda_multimidia: false,
    });

    if (error) {
      console.error(`  ✗ ${label}: ${error.message}`);
      fail += 1;
      continue;
    }

    console.log(`  ✓ ${label}`);
    ok += 1;
  }

  console.log(
    apply
      ? `Concluído: ${ok} inserida(s), ${updated} status atualizado(s), ${skippedExisting} já existente(s), ${fail} falha(s).`
      : `Simulação: ${ok} seriam inserida(s), ${updated} status atualizado(s), ${skippedExisting} já existente(s), ${fail} com problema(s). Rode com --apply.`
  );

  if (fail > 0) process.exit(1);
}

void main();
