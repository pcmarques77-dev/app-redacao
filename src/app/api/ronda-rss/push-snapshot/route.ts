import { pushRondaRssSnapshots } from "@/lib/ronda-rss-push-snapshot-core";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 120;

const JSON_NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
} as const;

/**
 * Disparo manual (botão “Atualizar Radar de Pautas”): equivale a
 * `npm run ronda:push-snapshot` — exige usuário autenticado.
 */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json(
      { ok: false, error: "Faça login para atualizar o radar." },
      { status: 401, headers: JSON_NO_STORE }
    );
  }

  const result = await pushRondaRssSnapshots();
  if (!result.ok) {
    console.error("[ronda-rss/push-snapshot]", result.error, result.kind ?? "");
    return NextResponse.json(
      { ok: false, error: result.error, kind: result.kind ?? null },
      { status: 500, headers: JSON_NO_STORE }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      totals: result.totals,
      updatedAt: new Date().toISOString(),
    },
    { headers: JSON_NO_STORE }
  );
}
