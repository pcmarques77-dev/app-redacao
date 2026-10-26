"use server";

import { createClient } from "@supabase/supabase-js";
import { getAdminActor } from "@/app/actions/admin";
import { dateToYmdLocal, ymdAddDays } from "@/lib/escala-query-range";
import {
  eagendasTokenConfigured,
  loadAgendasMinistros,
  type AgendaMinistroCard,
} from "@/lib/eagendas";

/** Precisa coincidir com a janela exibida em AgendasMinistrosPanel. */
const RADAR_AGENDAS_DAYS = 21;

export type AgendasMinistrosModo = "proximas" | "passadas";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function monthStartOf(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

function previousMonthStart(ymd: string): string {
  const [y, m] = ymd.split("-").map(Number);
  return dateToYmdLocal(new Date(y, m - 2, 1));
}

function radarAgendasRange(
  modo: AgendasMinistrosModo,
  now = new Date()
): { rangeStart: string; rangeEnd: string } {
  const today = dateToYmdLocal(now);
  if (modo === "passadas") {
    return {
      rangeStart: previousMonthStart(monthStartOf(today)),
      rangeEnd: ymdAddDays(today, -1),
    };
  }
  return { rangeStart: today, rangeEnd: ymdAddDays(today, RADAR_AGENDAS_DAYS) };
}

/** Compromissos públicos de ministros (próximas ou arquivo passado). */
export async function loadAgendasMinistrosAction(input?: {
  forceRefresh?: boolean;
  modo?: AgendasMinistrosModo;
}): Promise<
  | {
      ok: true;
      rows: AgendaMinistroCard[];
      tokenConfigured: boolean;
      rangeStart: string;
      rangeEnd: string;
      modo: AgendasMinistrosModo;
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

  const modo: AgendasMinistrosModo =
    input?.modo === "passadas" ? "passadas" : "proximas";
  const { rangeStart, rangeEnd } = radarAgendasRange(modo);
  if (rangeEnd < rangeStart) {
    return {
      ok: true,
      rows: [],
      tokenConfigured: eagendasTokenConfigured(),
      rangeStart,
      rangeEnd,
      modo,
    };
  }

  const rows = await loadAgendasMinistros(
    admin,
    rangeStart,
    rangeEnd,
    Boolean(input?.forceRefresh)
  );
  return {
    ok: true,
    rows,
    tokenConfigured: eagendasTokenConfigured(),
    rangeStart,
    rangeEnd,
    modo,
  };
}
