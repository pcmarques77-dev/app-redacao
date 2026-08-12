import { agregarTrendsSeo, type TrendsSeoAgregadoOk } from "@/lib/trends-seo";
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

const getTrendsLiveCached = unstable_cache(
  () => agregarTrendsSeo(),
  ["trends-seo-v1", "br"],
  { revalidate: 300 }
);

const getTrendsSnapshotCached = unstable_cache(
  () => readTrendsSeoSnapshotFromDb(),
  ["trends-seo-snapshot-v1", "br"],
  { revalidate: 60 }
);

async function lerSnapshot(refresh: boolean): Promise<TrendsSeoAgregadoOk | null> {
  return refresh ? readTrendsSeoSnapshotFromDb() : getTrendsSnapshotCached();
}

async function agregarAoVivo(refresh: boolean): Promise<TrendsSeoAgregadoOk> {
  return refresh ? agregarTrendsSeo() : getTrendsLiveCached();
}

async function resolverTrendsSeo(refresh: boolean): Promise<TrendsSeoAgregadoOk> {
  const snapshotPreferred =
    trendsSnapshotEnvEnabled() || preferSnapshotOnVercel();

  if (snapshotPreferred) {
    const snap = await lerSnapshot(refresh);
    if (snap != null && snap.total > 0) return snap;
    if (trendsSnapshotEnvEnabled() && snap != null) return snap;
    console.warn(
      "[trends-seo] snapshot vazio ou ausente; tentando agregação ao vivo."
    );
  } else if (!refresh) {
    const snap = await lerSnapshot(false);
    if (snap != null && snap.total > 0) return snap;
  }

  try {
    const live = await agregarAoVivo(refresh);
    const snap = await lerSnapshot(true);

    if (snap != null && snap.total > 0) {
      if (live.total <= 0) {
        console.warn(
          "[trends-seo] agregação ao vivo vazia; usando snapshot Supabase."
        );
        return snap;
      }
      if (live.total < snap.total) {
        console.warn(
          `[trends-seo] live parcial (${live.total} < snapshot ${snap.total}); mantendo snapshot.`
        );
        return snap;
      }
    }

    return live;
  } catch (e) {
    const snap = await lerSnapshot(true);
    if (snap != null && snap.total > 0) {
      console.warn(
        "[trends-seo] falha ao vivo; usando snapshot Supabase.",
        e instanceof Error ? e.message : e
      );
      return snap;
    }
    throw e;
  }
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
