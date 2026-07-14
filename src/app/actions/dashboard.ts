"use server";

import { createClient } from "@supabase/supabase-js";
import { getAdminActor } from "@/app/actions/admin";
import {
  queryEscalasOverlappingRange,
  type EscalaDashboardRow,
} from "@/app/actions/escalas";
import type { ReporterOptionRow } from "@/app/actions/pautas";
import {
  dashboardEscalaQueryRange,
  type DashboardEscalaQueryInput,
} from "@/lib/escala-query-range";
import {
  coercePautaStatus,
  type PautaDashboardRow,
} from "@/lib/pautas-shared";
import { filterUsuariosForSelects } from "@/lib/usuarios-select";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type LoadDashboardInput = DashboardEscalaQueryInput;

export type LoadDashboardSession = {
  userId: string;
  email: string;
  nome: string | null;
  funcao: string | null;
  isSuperAdmin: boolean;
  isEditor: boolean;
};

/**
 * Carrega sessão, pautas, escalas (intervalo do calendário) e repórteres em uma única
 * ida ao servidor — um `getAdminActor()` e queries em paralelo.
 */
export async function loadDashboardAction(
  input: LoadDashboardInput
): Promise<
  | {
      ok: true;
      session: LoadDashboardSession;
      pautas: PautaDashboardRow[];
      escalas: EscalaDashboardRow[];
      reporters: ReporterOptionRow[];
    }
  | { ok: false; error: string }
> {
  const actor = await getAdminActor();
  if (!actor.ok) return { ok: false, error: actor.error };

  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para esta operação.",
    };
  }

  const { rangeStart, rangeEnd } = dashboardEscalaQueryRange(input);

  const privileged = actor.isSuperAdmin || actor.isEditor;

  let pautasQuery = admin
    .from("pautas")
    .select(
      `
          id,
          titulo_provisorio,
          editoria,
          deadline,
          status,
          reporter_id,
          demanda_multimidia,
          reporter:usuarios!pautas_reporter_id_fkey(nome)
        `
    )
    .order("deadline", { ascending: true, nullsFirst: false });

  if (!privileged) {
    pautasQuery = pautasQuery.eq("reporter_id", actor.userId);
  }

  const [pautasResult, escalasResult, reportersResult] = await Promise.all([
    pautasQuery,
    queryEscalasOverlappingRange(admin, rangeStart, rangeEnd, actor.userId),
    privileged
      ? admin.from("usuarios").select("id, nome").order("nome", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (pautasResult.error) {
    return { ok: false, error: pautasResult.error.message };
  }
  if (!escalasResult.ok) {
    return { ok: false, error: escalasResult.error };
  }
  if (reportersResult.error) {
    return { ok: false, error: reportersResult.error.message };
  }

  const pautas = ((pautasResult.data ?? []) as unknown as PautaDashboardRow[]).map(
    (row) => {
      const rawStatus =
        typeof row.status === "string" || row.status === null
          ? row.status
          : null;
      const rawDm = (row as { demanda_multimidia?: unknown }).demanda_multimidia;
      return {
        ...row,
        status: coercePautaStatus(rawStatus),
        demanda_multimidia: rawDm === true,
      };
    }
  );

  return {
    ok: true,
    session: {
      userId: actor.userId,
      email: actor.email,
      nome: actor.nome,
      funcao: actor.funcao,
      isSuperAdmin: actor.isSuperAdmin,
      isEditor: actor.isEditor,
    },
    pautas,
    escalas: escalasResult.rows,
    reporters: filterUsuariosForSelects(
      (reportersResult.data ?? []) as ReporterOptionRow[]
    ),
  };
}
