import { agregarRondaRss, type RondaRssKind } from "@/lib/ronda-rss-agregado";
import {
  readRondaRssSnapshotFromDb,
  RONDA_RSS_SNAPSHOT_ROW,
} from "@/lib/ronda-rss-snapshot";
import { unstable_cache } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

export const maxDuration = 120;

function kindFromRequest(request: NextRequest): RondaRssKind {
  return request.nextUrl.searchParams.get("kind") === "tech" ? "tech" : "gov";
}

const getRondaRssCachedGov = unstable_cache(
  () => agregarRondaRss("gov"),
  ["ronda-rss-v3", "gov"],
  { revalidate: 90 }
);

const getRondaRssCachedTech = unstable_cache(
  () => agregarRondaRss("tech"),
  ["ronda-rss-v3", "tech"],
  { revalidate: 90 }
);

const getSnapshotCachedGov = unstable_cache(
  () => readRondaRssSnapshotFromDb("gov"),
  ["ronda-rss-snapshot-v2", "gov"],
  { revalidate: 45 }
);

const getSnapshotCachedTech = unstable_cache(
  () => readRondaRssSnapshotFromDb("tech"),
  ["ronda-rss-snapshot-v2", "tech"],
  { revalidate: 45 }
);

const JSON_NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
} as const;

function rondaRssSnapshotEnvEnabled(): boolean {
  return process.env.RONDA_RSS_USE_SUPABASE_SNAPSHOT === "1";
}

function cachedAggregator(kind: RondaRssKind) {
  return kind === "tech" ? getRondaRssCachedTech : getRondaRssCachedGov;
}

function snapshotReaderCached(kind: RondaRssKind) {
  return kind === "tech" ? getSnapshotCachedTech : getSnapshotCachedGov;
}

export async function GET(request: NextRequest) {
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const kind = kindFromRequest(request);

  try {
    if (rondaRssSnapshotEnvEnabled()) {
      const snap = refresh
        ? await readRondaRssSnapshotFromDb(kind)
        : await snapshotReaderCached(kind)();
      if (snap != null) {
        return NextResponse.json(snap, { headers: JSON_NO_STORE });
      }
      console.warn(
        `[ronda-rss] RONDA_RSS_USE_SUPABASE_SNAPSHOT=1 mas snapshot ausente ou inválido (${kind}, id ${RONDA_RSS_SNAPSHOT_ROW[kind]}); usando agregação ao vivo.`
      );
    }

    const data = refresh
      ? await agregarRondaRss(kind)
      : await cachedAggregator(kind)();
    return NextResponse.json(data, { headers: JSON_NO_STORE });
  } catch (e) {
    console.error("[ronda-rss]", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao montar o Radar de Pautas." },
      { status: 500, headers: JSON_NO_STORE }
    );
  }
}
