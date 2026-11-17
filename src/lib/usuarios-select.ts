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

export function isOcultoListaJornalistas(value: unknown): boolean {
  return value === true;
}

export function filterUsuariosForSelects<
  T extends {
    nome: string | null;
    email?: string | null;
    oculto_lista_jornalistas?: boolean | null;
  },
>(rows: T[]): T[] {
  return rows.filter(
    (r) =>
      !isHiddenOperationalUsuario(r) &&
      !isOcultoListaJornalistas(r.oculto_lista_jornalistas)
  );
}

/**
 * Mantém na lista quem já está atribuído, mesmo oculto, para a edição
 * não trocar o jornalista sem querer.
 */
export function withAssignedUsuario<T extends { id: string; nome: string | null }>(
  rows: T[],
  assignedId: string | null | undefined,
  assignedNome?: string | null
): T[] {
  const id = (assignedId ?? "").trim();
  if (!id || rows.some((row) => row.id === id)) return rows;
  const nome = assignedNome?.trim() || "Jornalista oculto";
  return [...rows, { id, nome } as T];
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
