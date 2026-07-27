import { cache } from "react";
import { getSessionPrivilegesAction } from "@/app/actions/admin";
import {
  PautasAppHeader,
  type PautasHeaderSession,
} from "@/components/PautasAppHeader";

/** Deduplica a leitura de sessão no mesmo request RSC. */
export const loadPautasHeaderSession = cache(
  async (): Promise<PautasHeaderSession | null> => {
    const res = await getSessionPrivilegesAction();
    if (!res.ok) return null;
    return {
      userId: res.session.userId,
      email: res.session.email,
      nome: res.session.nome,
      canManageEscala: res.session.canManageEscala,
    };
  }
);

/** Header com sessão resolvida no servidor (nav sem flash no cliente). */
export async function PautasAppHeaderServer() {
  const session = await loadPautasHeaderSession();
  return <PautasAppHeader session={session} />;
}
