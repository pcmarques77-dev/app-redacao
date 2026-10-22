import { isSuperAdminEmail } from "@/lib/admin-acl";

/** Nomes de contas de teste ocultas em selects operacionais (não no Admin). */
const HIDDEN_SELECT_USUARIO_NOMES = new Set([
  "teste editor",
  "teste reporter",
]);

function normalizeUsuarioNomeKey(nome: string | null | undefined): string {
  return (nome ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function isHiddenFromUsuarioSelects(
  nome: string | null | undefined
): boolean {
  return HIDDEN_SELECT_USUARIO_NOMES.has(normalizeUsuarioNomeKey(nome));
}

/** Conta master e contas de teste: fora de selects, calendário e demais listas. */
export function isHiddenOperationalUsuario(args: {
  nome?: string | null;
  email?: string | null;
}): boolean {
  if (isSuperAdminEmail(args.email)) return true;
  return isHiddenFromUsuarioSelects(args.nome);
}

export function filterUsuariosForSelects<
  T extends { nome: string | null; email?: string | null },
>(rows: T[]): T[] {
  return rows.filter((r) => !isHiddenOperationalUsuario(r));
}

/**
 * Nome exibido em pautas e cards. Contas ocultas ficam sem nome
 * para o registro continuar visível sem identificar a conta.
 */
export function reporterNomeVisivel(
  reporter:
    | { nome?: string | null; email?: string | null }
    | null
    | undefined
): { nome: string | null } | null {
  if (!reporter) return null;
  if (isHiddenOperationalUsuario(reporter)) return { nome: null };
  return { nome: reporter.nome ?? null };
}

/** Contas que não entram em reset de senha inicial em lote (admin + testes). */
export function isExcludedFromBatchPasswordReset(args: {
  email: string | null | undefined;
  nome: string | null | undefined;
}): boolean {
  return isHiddenOperationalUsuario(args);
}
