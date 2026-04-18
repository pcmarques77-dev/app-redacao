/**
 * Normaliza prazo (Postgres date ou timestamptz) para YYYY-MM-DD.
 * Usa os dígitos iniciais quando a string já começa com data ISO, evitando
 * reinterpretar o instante em fuso local só para obter o dia civil.
 */
export function parseDeadlineToYmd(value: string | null | undefined): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Exibe DD/MM/AAAA a partir de YYYY-MM-DD (sem horário nem fuso). */
export function formatDeadlinePtBR(ymd: string | null | undefined): string {
  const raw = ymd?.trim();
  if (!raw) return "—";
  const parts = raw.split("-");
  if (parts.length !== 3) return raw;
  const [y, mo, d] = parts;
  if (!y || !mo || !d) return raw;
  return `${d.padStart(2, "0")}/${mo.padStart(2, "0")}/${y}`;
}

export function deadlineYmdSortKey(value: string | null | undefined): number | null {
  const ymd = parseDeadlineToYmd(value);
  if (!ymd) return null;
  return parseInt(ymd.replace(/-/g, ""), 10);
}

/**
 * Minutos desde meia-noite (0–1439) quando o prazo inclui horário (ex.: ISO com `T`);
 * `null` para data pura `YYYY-MM-DD` ou valor inválido.
 */
export function deadlineTimeOfDayMinutes(
  value: string | null | undefined
): number | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return d.getHours() * 60 + d.getMinutes();
}
