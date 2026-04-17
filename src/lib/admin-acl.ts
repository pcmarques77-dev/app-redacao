/** E-mail do super administrador (acesso total ao painel Admin). */
export const SUPER_ADMIN_EMAIL = "editor@viva.com.br";

export function normalizeAdminEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return normalizeAdminEmail(email) === SUPER_ADMIN_EMAIL.toLowerCase();
}

/** Função na tabela `public.usuarios` com permissão de criar utilizadores. */
export function isEditorRole(funcao: string | null | undefined): boolean {
  return (funcao ?? "").trim() === "Editor";
}

/** Super admin ou Editor: gerenciar cadastro de escala (plantão, férias, feriado). */
export function canManageEscala(args: {
  email: string | null | undefined;
  funcao: string | null | undefined;
}): boolean {
  return isSuperAdminEmail(args.email) || isEditorRole(args.funcao);
}

/** Quem pode editar ou excluir uma pauta no painel (super admin, Editor ou autor). */
export function canUserEditOrDeletePauta(args: {
  currentUserId: string;
  currentUserEmail: string;
  currentUserRole: string | null;
  pautaReporterId: string | null;
}): boolean {
  if (isSuperAdminEmail(args.currentUserEmail)) return true;
  if (isEditorRole(args.currentUserRole)) return true;
  const rid = (args.pautaReporterId ?? "").trim();
  return rid !== "" && rid === args.currentUserId;
}
