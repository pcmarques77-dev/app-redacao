import { type TrendsSeoAgregadoOk } from "@/lib/trends-seo";
import { pushTrendsSeoSnapshot } from "@/lib/trends-seo-push-snapshot-core";
import { readTrendsSeoSnapshotFromDb } from "@/lib/trends-seo-snapshot";
import { unstable_cache } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

export const maxDuration = 60;

const JSON_NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
} as const;

function trendsSnapshotEnvEnabled(): boolean {
  return process.env.TRENDS_SEO_USE_SUPABASE_SNAPSHOT === "1";
}

function preferSnapshotOnVercel(): boolean {
  return process.env.VERCEL === "1";
}

const getTrendsSnapshotCached = unstable_cache(
  () => readTrendsSeoSnapshotFromDb(),
  ["trends-seo-snapshot-v1", "br"],
  { revalidate: 60 }
);

async function lerSnapshot(refresh: boolean): Promise<TrendsSeoAgregadoOk | null> {
  return refresh ? readTrendsSeoSnapshotFromDb() : getTrendsSnapshotCached();
}

/**
 * - Carga normal: prefere snapshot (Vercel / env).
 * - refresh=1 (botão Atualizar): busca ao vivo, grava snapshot e devolve dados frescos.
 */
async function resolverTrendsSeo(refresh: boolean): Promise<TrendsSeoAgregadoOk> {
  if (refresh) {
    const pushed = await pushTrendsSeoSnapshot();
    if (pushed.ok && pushed.total > 0) {
      return pushed.payload;
    }

    const snap = await lerSnapshot(true);
    if (snap != null && snap.total > 0) {
      if (!pushed.ok) {
        console.warn(
          "[trends-seo] refresh ao vivo falhou; usando snapshot Supabase.",
          pushed.error
        );
      } else {
        console.warn(
          "[trends-seo] refresh ao vivo vazio; mantendo snapshot anterior."
        );
      }
      return snap;
    }

    if (pushed.ok) {
      return pushed.payload;
    }
    throw new Error(pushed.error);
  }

  const snapshotPreferred =
    trendsSnapshotEnvEnabled() || preferSnapshotOnVercel();

  if (snapshotPreferred) {
    const snap = await lerSnapshot(false);
    if (snap != null && snap.total > 0) return snap;
    if (trendsSnapshotEnvEnabled() && snap != null) return snap;
    console.warn(
      "[trends-seo] snapshot vazio ou ausente; tentando agregação ao vivo."
    );
  } else {
    const snap = await lerSnapshot(false);
    if (snap != null && snap.total > 0) return snap;
  }

  const pushed = await pushTrendsSeoSnapshot();
  if (pushed.ok && pushed.total > 0) return pushed.payload;

  const snap = await lerSnapshot(true);
  if (snap != null && snap.total > 0) {
    console.warn(
      "[trends-seo] agregação ao vivo vazia/falhou; usando snapshot Supabase.",
      pushed.ok ? null : pushed.error
    );
    return snap;
  }

  if (pushed.ok) return pushed.payload;
  throw new Error(pushed.error);
}

/** Assuntos em alta no Google Trends (Brasil) — descoberta SEO. */
export async function GET(request: NextRequest) {
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  try {
    const data = await resolverTrendsSeo(refresh);
    return NextResponse.json(data, { headers: JSON_NO_STORE });
  } catch (e) {
    console.error("[trends-seo]", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao carregar o Google Trends." },
      { status: 500, headers: JSON_NO_STORE }
    );
  }
}
