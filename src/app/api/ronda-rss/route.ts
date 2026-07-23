import {
  agregarRondaRss,
  type RondaRssAgregadoOk,
  type RondaRssKind,
} from "@/lib/ronda-rss-agregado";
import { readRondaRssSnapshotFromDb } from "@/lib/ronda-rss-snapshot";
import { unstable_cache } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

export const maxDuration = 120;

/**
 * Google News / vários jornais falham na Vercel → snapshot primeiro.
 * Gov e Tech costumam responder (CDN); live no "Atualizar" ainda faz sentido.
 */
const SNAPSHOT_FIRST_ON_VERCEL_KINDS = new Set<RondaRssKind>([
  "inss",
  "longevidade",
  "jornais",
]);

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

function preferSnapshotOnVercel(kind: RondaRssKind): boolean {
  return process.env.VERCEL === "1" && SNAPSHOT_FIRST_ON_VERCEL_KINDS.has(kind);
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
  ["ronda-rss-snapshot-v5", "gov"],
  { revalidate: 45 }
);

const getSnapshotCachedTech = unstable_cache(
  () => readRondaRssSnapshotFromDb("tech"),
  ["ronda-rss-snapshot-v5", "tech"],
  { revalidate: 45 }
);

const getSnapshotCachedInss = unstable_cache(
  () => readRondaRssSnapshotFromDb("inss"),
  ["ronda-rss-snapshot-v5", "inss"],
  { revalidate: 45 }
);

const getSnapshotCachedLongevidade = unstable_cache(
  () => readRondaRssSnapshotFromDb("longevidade"),
  ["ronda-rss-snapshot-v5", "longevidade"],
  { revalidate: 45 }
);

const getSnapshotCachedJornais = unstable_cache(
  () => readRondaRssSnapshotFromDb("jornais"),
  ["ronda-rss-snapshot-v5", "jornais"],
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
  const snapshotOnlyKinds =
    rondaRssSnapshotEnvEnabled() || preferSnapshotOnVercel(kind);

  if (snapshotOnlyKinds) {
    // INSS / Longevidade / Jornais: live na Vercel é inútil; refresh só relê o DB.
    const snap = await lerSnapshot(kind, refresh);
    if (snap != null && snap.total > 0) return snap;
    if (rondaRssSnapshotEnvEnabled() && snap != null) return snap;
    console.warn(
      `[ronda-rss] snapshot vazio ou ausente (${kind}); tentando agregação ao vivo.`
    );
  } else if (!refresh) {
    // Gov/Tech: 1ª carga prefere snapshot completo (scraper).
    const snap = await lerSnapshot(kind, false);
    if (snap != null && snap.total > 0) return snap;
  }

  const live = await agregarAoVivo(kind, refresh);
  const snap = await lerSnapshot(kind, true);

  // Live parcial na Vercel (ex.: 1 item Agência SP) NÃO deve sobrescrever o snapshot.
  if (snap != null && snap.total > 0) {
    if (live.total <= 0) {
      console.warn(
        `[ronda-rss] agregação ao vivo vazia (${kind}); usando snapshot Supabase.`
      );
      return snap;
    }
    if (live.total < snap.total) {
      console.warn(
        `[ronda-rss] live parcial (${kind}: ${live.total} < snapshot ${snap.total}); mantendo snapshot.`
      );
      return snap;
    }
  }

  return live;
}

/** Gov/Tech: snapshot na abertura; live no Atualizar só se for pelo menos tão completo quanto o snapshot. */
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
