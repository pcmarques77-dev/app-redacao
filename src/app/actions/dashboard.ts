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
  deadlineBoundsForRange,
  type DashboardEscalaQueryInput,
} from "@/lib/escala-query-range";
import {
  coercePautaStatus,
  type PautaDashboardRow,
} from "@/lib/pautas-shared";
import {
  filterUsuariosForSelects,
  reporterNomeVisivel,
} from "@/lib/usuarios-select";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type LoadDashboardInput = DashboardEscalaQueryInput;

export type PautasListSortColumn =
  | "reporter"
  | "titulo"
  | "editoria"
  | "prazo"
  | "status";

export type PautasListQuery = {
  offset: number;
  limit: number;
  sortColumn: PautasListSortColumn;
  sortDirection: "asc" | "desc";
  filtroReporter: string;
  filtroEditoria: string;
};

/** Dados da home já resolvidos no servidor, no mesmo request do cabeçalho. */
export type DashboardInitialData = {
  session: LoadDashboardSession;
  pautas: PautaDashboardRow[];
  escalas: EscalaDashboardRow[];
  reporters: ReporterOptionRow[];
  query: LoadDashboardInput;
};

const PAUTA_DASHBOARD_SELECT = `
          id,
          titulo_provisorio,
          editoria,
          deadline,
          status,
          reporter_id,
          demanda_multimidia,
          reporter:usuarios!pautas_reporter_id_fkey(nome, email)
        `;

const PAUTA_DASHBOARD_SELECT_INNER = `
          id,
          titulo_provisorio,
          editoria,
          deadline,
          status,
          reporter_id,
          demanda_multimidia,
          reporter:usuarios!pautas_reporter_id_fkey!inner(nome, email)
        `;

function mapDashboardPautas(data: unknown): PautaDashboardRow[] {
  return (
    (data ?? []) as (PautaDashboardRow & {
      reporter?: { nome: string | null; email?: string | null } | null;
    })[]
  ).map((row) => {
    const rawStatus =
      typeof row.status === "string" || row.status === null ? row.status : null;
    const rawDm = (row as { demanda_multimidia?: unknown }).demanda_multimidia;
    return {
      ...row,
      reporter: reporterNomeVisivel(row.reporter),
      status: coercePautaStatus(rawStatus),
      demanda_multimidia: rawDm === true,
    };
  });
}

export type LoadDashboardSession = {
  userId: string;
  email: string;
  nome: string | null;
  funcao: string | null;
  isSuperAdmin: boolean;
  isEditor: boolean;
};

/**
 * Carrega sessão, pautas, escalas (intervalo do calendário) e repórteres em uma
 * única ida ao servidor — um `getAdminActor()` e queries em paralelo.
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
  const bounds = deadlineBoundsForRange(rangeStart, rangeEnd);

  const privileged = actor.isSuperAdmin || actor.isEditor;

  let pautasQuery = admin
    .from("pautas")
    .select(PAUTA_DASHBOARD_SELECT)
    .eq("hard_news", false)
    .gte("deadline", bounds.gte)
    .lt("deadline", bounds.lt)
    .order("deadline", { ascending: true, nullsFirst: false });

  if (!privileged) {
    pautasQuery = pautasQuery.eq("reporter_id", actor.userId);
  }

  const [pautasResult, escalasResult, reportersResult] = await Promise.all([
    pautasQuery,
    queryEscalasOverlappingRange(admin, rangeStart, rangeEnd, actor.userId),
    privileged
      ? admin
          .from("usuarios")
          .select("id, nome, email")
          .order("nome", { ascending: true })
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
    pautas: mapDashboardPautas(pautasResult.data),
    escalas: escalasResult.rows,
    reporters: filterUsuariosForSelects(
      (reportersResult.data ?? []) as (ReporterOptionRow & {
        email?: string | null;
      })[]
    ).map(({ id, nome }) => ({ id, nome })),
  };
}

/**
 * Página da vista de lista (histórico inteiro, com filtro e ordenação).
 * O calendário usa `loadDashboardAction`, limitado ao intervalo visível.
 */
export async function listPautasPageAction(
  input: PautasListQuery
): Promise<
  | { ok: true; rows: PautaDashboardRow[]; total: number }
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

  const limit = Math.min(100, Math.max(1, Math.floor(input.limit)));
  const offset = Math.max(0, Math.floor(input.offset));
  const filtroReporter = input.filtroReporter.trim();
  const filtroEditoria = input.filtroEditoria.trim();
  const filterReporter =
    filtroReporter.length > 0 && filtroReporter !== "Todos";
  const filterEditoria =
    filtroEditoria.length > 0 && filtroEditoria !== "Todos";
  const privileged = actor.isSuperAdmin || actor.isEditor;
  const ascending = input.sortDirection !== "desc";

  let q = admin
    .from("pautas")
    .select(
      filterReporter ? PAUTA_DASHBOARD_SELECT_INNER : PAUTA_DASHBOARD_SELECT,
      { count: "exact" }
    )
    .eq("hard_news", false);

  if (!privileged) {
    q = q.eq("reporter_id", actor.userId);
  }
  if (filterEditoria) {
    q = q.eq("editoria", filtroEditoria);
  }
  if (filterReporter) {
    q = q.eq("reporter.nome", filtroReporter);
  }

  if (input.sortColumn === "reporter") {
    q = q.order("nome", {
      referencedTable: "usuarios",
      ascending,
      nullsFirst: false,
    });
  } else if (input.sortColumn === "titulo") {
    q = q.order("titulo_provisorio", { ascending, nullsFirst: false });
  } else if (input.sortColumn === "editoria") {
    q = q.order("editoria", { ascending, nullsFirst: false });
  } else if (input.sortColumn === "status") {
    q = q.order("status", { ascending, nullsFirst: false });
  } else {
    q = q.order("deadline", { ascending, nullsFirst: false });
  }

  const { data, error, count } = await q
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return { ok: false, error: error.message };

  const rows = mapDashboardPautas(data);
  return { ok: true, rows, total: count ?? rows.length };
}
