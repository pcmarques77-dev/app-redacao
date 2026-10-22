"use server";

import { createClient } from "@supabase/supabase-js";
import { getAdminActor } from "@/app/actions/admin";
import {
  dashboardEscalaQueryRange,
  type DashboardEscalaQueryInput,
} from "@/lib/escala-query-range";
import {
  loadAgendasMinistros,
  type AgendaMinistroCard,
} from "@/lib/eagendas";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Compromissos de ministros no intervalo visível do calendário. */
export async function loadAgendasMinistrosAction(
  input: DashboardEscalaQueryInput
): Promise<{ ok: true; rows: AgendaMinistroCard[] } | { ok: false; error: string }> {
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
  const rows = await loadAgendasMinistros(admin, rangeStart, rangeEnd);
  return { ok: true, rows };
}
