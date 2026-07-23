import {
  agregarRondaRss,
  type RondaRssAgregadoOk,
  type RondaRssKind,
} from "@/lib/ronda-rss-agregado";
import { readRondaRssSnapshotFromDb } from "@/lib/ronda-rss-snapshot";
import { unstable_cache } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

export const maxDuration = 120;

function kindFromRequest(request: NextRequest): RondaRssKind {
  const kind = request.nextUrl.searchParams.get("kind");
  if (kind === "tech") return "tech";
  if (kind === "inss") return "inss";
  if (kind === "longevidade") return "longevidade";
  if (kind === "jornais") return "jornais";
  return "gov";
}

function rondaRssSnapshotEnvEnabled(): boolean {
  return process.env.RONDA_RSS_USE_SUPABASE_SNAPSHOT === "1";
}

/** Na Vercel o fetch RSS costuma falhar/parcial; o scraper grava o snapshot. */
function preferSnapshotOnVercel(): boolean {
  return process.env.VERCEL === "1";
}

const getRondaRssCachedGov = unstable_cache(
  () => agregarRondaRss("gov"),
  ["ronda-rss-v5", "gov"],
  { revalidate: 90 }
);

const getRondaRssCachedTech = unstable_cache(
  () => agregarRondaRss("tech"),
  ["ronda-rss-v5", "tech"],
  { revalidate: 90 }
);

const getRondaRssCachedInss = unstable_cache(
  () => agregarRondaRss("inss"),
  ["ronda-rss-v5", "inss"],
  { revalidate: 90 }
);

const getRondaRssCachedLongevidade = unstable_cache(
  () => agregarRondaRss("longevidade"),
  ["ronda-rss-v5", "longevidade"],
  { revalidate: 90 }
);

const getRondaRssCachedJornais = unstable_cache(
  () => agregarRondaRss("jornais"),
  ["ronda-rss-v5", "jornais"],
  { revalidate: 90 }
);

const getSnapshotCachedGov = unstable_cache(
  () => readRondaRssSnapshotFromDb("gov"),
  ["ronda-rss-snapshot-v4", "gov"],
  { revalidate: 45 }
);

const getSnapshotCachedTech = unstable_cache(
  () => readRondaRssSnapshotFromDb("tech"),
  ["ronda-rss-snapshot-v4", "tech"],
  { revalidate: 45 }
);

const getSnapshotCachedInss = unstable_cache(
  () => readRondaRssSnapshotFromDb("inss"),
  ["ronda-rss-snapshot-v4", "inss"],
  { revalidate: 45 }
);

const getSnapshotCachedLongevidade = unstable_cache(
  () => readRondaRssSnapshotFromDb("longevidade"),
  ["ronda-rss-snapshot-v4", "longevidade"],
  { revalidate: 45 }
);

const getSnapshotCachedJornais = unstable_cache(
  () => readRondaRssSnapshotFromDb("jornais"),
  ["ronda-rss-snapshot-v4", "jornais"],
  { revalidate: 45 }
);

const JSON_NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
} as const;

function cachedAggregator(kind: RondaRssKind) {
  switch (kind) {
    case "tech":
      return getRondaRssCachedTech;
    case "inss":
      return getRondaRssCachedInss;
    case "longevidade":
      return getRondaRssCachedLongevidade;
    case "jornais":
      return getRondaRssCachedJornais;
    default:
      return getRondaRssCachedGov;
  }
}

function snapshotReaderCached(kind: RondaRssKind) {
  switch (kind) {
    case "tech":
      return getSnapshotCachedTech;
    case "inss":
      return getSnapshotCachedInss;
    case "longevidade":
      return getSnapshotCachedLongevidade;
    case "jornais":
      return getSnapshotCachedJornais;
    default:
      return getSnapshotCachedGov;
  }
}

async function lerSnapshot(
  kind: RondaRssKind,
  refresh: boolean
): Promise<RondaRssAgregadoOk | null> {
  return refresh
    ? readRondaRssSnapshotFromDb(kind)
    : snapshotReaderCached(kind)();
}

async function agregarAoVivo(kind: RondaRssKind, refresh: boolean) {
  return refresh ? agregarRondaRss(kind) : cachedAggregator(kind)();
}

async function resolverRondaRss(
  kind: RondaRssKind,
  refresh: boolean
): Promise<RondaRssAgregadoOk> {
  // `refresh=1` só ignora o cache Next e relê o Supabase — não dispara fetch
  // ao vivo na Vercel (isso devolvia lista parcial e “ganhava” do snapshot).
  const snapshotPrimary =
    rondaRssSnapshotEnvEnabled() || preferSnapshotOnVercel();

  if (snapshotPrimary) {
    const snap = await lerSnapshot(kind, refresh);
    if (snap != null && snap.total > 0) return snap;
    if (rondaRssSnapshotEnvEnabled() && snap != null) return snap;
    console.warn(
      `[ronda-rss] snapshot vazio ou ausente (${kind}); tentando agregação ao vivo.`
    );
  }

  const live = await agregarAoVivo(kind, refresh);
  if (live.total > 0) return live;

  const snap = await lerSnapshot(kind, true);
  if (snap != null && snap.total > 0) {
    console.warn(
      `[ronda-rss] agregação ao vivo vazia (${kind}); usando snapshot Supabase.`
    );
    return snap;
  }

  return live;
}

/** Na Vercel lê snapshot Supabase; fora dela agrega RSS (com fallback ao snapshot). */
export async function GET(request: NextRequest) {
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const kind = kindFromRequest(request);

  try {
    const data = await resolverRondaRss(kind, refresh);
    return NextResponse.json(data, { headers: JSON_NO_STORE });
  } catch (e) {
    console.error("[ronda-rss]", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao montar o Radar de Pautas." },
      { status: 500, headers: JSON_NO_STORE }
    );
  }
}
