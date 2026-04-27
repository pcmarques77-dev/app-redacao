import { agregarRondaRss } from "@/lib/ronda-rss-agregado";
import { readRondaRssSnapshotFromDb } from "@/lib/ronda-rss-snapshot";
import { unstable_cache } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

export const maxDuration = 120;

const getRondaRssCached = unstable_cache(agregarRondaRss, ["ronda-rss-v2"], {
  revalidate: 90,
});

const getSnapshotCached = unstable_cache(readRondaRssSnapshotFromDb, [
  "ronda-rss-snapshot-v1",
], {
  revalidate: 45,
});

const JSON_NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
} as const;

function rondaRssSnapshotEnvEnabled(): boolean {
  return process.env.RONDA_RSS_USE_SUPABASE_SNAPSHOT === "1";
}

export async function GET(request: NextRequest) {
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  try {
    if (rondaRssSnapshotEnvEnabled()) {
      const snap = refresh
        ? await readRondaRssSnapshotFromDb()
        : await getSnapshotCached();
      if (snap != null) {
        return NextResponse.json(snap, { headers: JSON_NO_STORE });
      }
      console.warn(
        "[ronda-rss] RONDA_RSS_USE_SUPABASE_SNAPSHOT=1 mas snapshot ausente ou inválido; usando agregação ao vivo."
      );
    }

    const data = refresh ? await agregarRondaRss() : await getRondaRssCached();
    return NextResponse.json(data, { headers: JSON_NO_STORE });
  } catch (e) {
    console.error("[ronda-rss]", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao montar o Radar de Pautas." },
      { status: 500, headers: JSON_NO_STORE }
    );
  }
}
