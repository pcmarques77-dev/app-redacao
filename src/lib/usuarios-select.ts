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

export function filterUsuariosForSelects<T extends { nome: string | null }>(
  rows: T[]
): T[] {
  return rows.filter((r) => !isHiddenFromUsuarioSelects(r.nome));
}

/** Contas que não entram em reset de senha inicial em lote (admin + testes). */
export function isExcludedFromBatchPasswordReset(args: {
  email: string | null | undefined;
  nome: string | null | undefined;
}): boolean {
  const email = (args.email ?? "").trim().toLowerCase();
  if (email === "editor@viva.com.br") return true;
  return isHiddenFromUsuarioSelects(args.nome);
}
