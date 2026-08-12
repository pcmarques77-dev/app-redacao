import Parser from "rss-parser";

/** Feed público “Em alta” (fallback; costuma vir com ~10 itens). */
export const TRENDS_SEO_RSS_URL =
  "https://trends.google.com/trending/rss?geo=BR";

/** RPC interno da página /trending (lista longa). */
export const TRENDS_SEO_BATCHEXECUTE_URL =
  "https://trends.google.com/_/TrendsUi/data/batchexecute?rpcids=i0OFE&source-path=%2Ftrending&hl=pt-BR";

/** Janela “últimas 24 horas” na UI Em alta (Google: 4 | 24 | 48 | 168). */
export const TRENDS_SEO_HOURS = 24;

/** Quantidade máxima exibida no Radar (após ordenação no cliente). */
export const TRENDS_SEO_LIMIT = 50;

/** Máximo enviado pela API (pool para reordenar por data ou volume). */
export const TRENDS_SEO_PAYLOAD_MAX = 300;

/**
 * Categorias do Google Trends a excluir da descoberta SEO.
 * 17 = Sports (confirmado na UI / SerpApi: futebol, NBA, etc.).
 */
export const TRENDS_SEO_EXCLUDED_CATEGORY_IDS = new Set<number>([17]);

/** Heurística só para o fallback RSS (sem categorias no feed). */
const TRENDS_SEO_SPORTS_TERM_RE =
  /\b(futebol|brasileir[aã]o|libertadores|champions\s*league|copa do brasil|copa do mundo|sele[cç][aã]o brasileira|nba|nfl|mlb|nhl|ufc|mma|olimp[ií]|ol[ií]mpi|t[eê]nis|formula\s*1|\bf1\b|moto\s*gp|v[oô]lei|basquete|handebol|automobilismo|girod'?italia|tour de france|wimbledon|premier league|la liga|série a|serie a)\b/i;

const TRENDS_SEO_MATCH_RE =
  /\b[\p{L}\d.]+\s+[x×]\s+[\p{L}\d.]+\b/iu;

export type TrendSeoItem = {
  /** Termo em alta (query). */
  titulo: string;
  /** Explore no Google Trends (geo=BR). */
  link: string;
  fonte: "Google Trends";
  /** Quando o item entrou na lista agregada (ISO). */
  data_publicacao: string;
  /** Início aproximado da tendência (ISO), se parseável. */
  publicado_em: string | null;
  /** Volume aproximado, ex.: "10.000+" ou "1.000.000". */
  destaque: string | null;
  /** Valor numérico para ordenação. */
  volumeOrdenacao: number;
};

export type TrendsSeoAgregadoOk = {
  ok: true;
  noticias: TrendSeoItem[];
  total: number;
  geo: "BR";
  fonte: "google-trends-batchexecute" | "google-trends-rss";
};

type TrendsRssItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  approxTraffic?: string;
};

function formatVolumeDestaque(n: number): string {
  const formatted = n.toLocaleString("pt-BR");
  return `${formatted}+ buscas`;
}

function parseTrafficVolume(raw: string | undefined): {
  destaque: string | null;
  volumeOrdenacao: number;
} {
  if (!raw?.trim()) return { destaque: null, volumeOrdenacao: 0 };
  const cleaned = raw.trim();
  const digits = cleaned.replace(/[^\d]/g, "");
  const n = digits ? Number(digits) : 0;
  if (!Number.isFinite(n) || n <= 0) {
    return { destaque: cleaned, volumeOrdenacao: 0 };
  }
  return { destaque: formatVolumeDestaque(n), volumeOrdenacao: n };
}

function unixSecondsToIso(sec: unknown): string | null {
  if (typeof sec !== "number" || !Number.isFinite(sec) || sec <= 0) return null;
  // Trends às vezes manda epoch “futuro” em escala diferente; se for absurdo, ignora.
  // Valores observados ~1.7e9 (2024+) — aceitar faixa razoável.
  if (sec < 1_000_000_000 || sec > 4_000_000_000) return null;
  return new Date(sec * 1000).toISOString();
}

function pubDateToIso(item: TrendsRssItem): string | null {
  if (item.isoDate) {
    const t = new Date(item.isoDate).getTime();
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  if (item.pubDate) {
    const t = new Date(item.pubDate).getTime();
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return null;
}

function exploreUrl(term: string): string {
  const q = encodeURIComponent(term);
  // date=now 1-d alinha o Explore com a janela de 24 horas.
  return `https://trends.google.com/trends/explore?date=now%201-d&geo=BR&q=${q}`;
}

/** Ordena por data (recente→antigo); desempate por volume. Limita o payload da API. */
function sortAndLimit(noticias: TrendSeoItem[]): TrendSeoItem[] {
  const sorted = [...noticias].sort((a, b) => {
    const ta = a.publicado_em ? new Date(a.publicado_em).getTime() : 0;
    const tb = b.publicado_em ? new Date(b.publicado_em).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return b.volumeOrdenacao - a.volumeOrdenacao;
  });
  return sorted.slice(0, TRENDS_SEO_PAYLOAD_MAX);
}

function hasExcludedCategory(cats: unknown): boolean {
  if (!Array.isArray(cats)) return false;
  return cats.some(
    (c) =>
      typeof c === "number" && TRENDS_SEO_EXCLUDED_CATEGORY_IDS.has(c)
  );
}

/** Fallback RSS: sem id de categoria, usa padrões de esporte/futebol. */
function looksLikeSportsTerm(titulo: string): boolean {
  const t = titulo.trim();
  if (!t) return false;
  if (TRENDS_SEO_SPORTS_TERM_RE.test(t)) return true;
  // Confrontos típicos: "fortaleza x palmeiras", "ajax x shelbourne"
  if (TRENDS_SEO_MATCH_RE.test(t)) return true;
  return false;
}

function extractBatchexecuteList(raw: string): unknown[] {
  const cleaned = raw.replace(/^\)\]\}'\s*/, "").trim();
  const parsed = JSON.parse(cleaned) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Resposta batchexecute inválida.");
  }
  const first = parsed[0];
  if (!Array.isArray(first) || typeof first[2] !== "string") {
    throw new Error("Payload batchexecute sem dados aninhados.");
  }
  const nested = JSON.parse(first[2]) as unknown;
  if (!Array.isArray(nested) || !Array.isArray(nested[1])) {
    throw new Error("Lista de tendências ausente no batchexecute.");
  }
  return nested[1] as unknown[];
}

async function agregarViaBatchexecute(): Promise<TrendsSeoAgregadoOk> {
  const fReq = JSON.stringify([
    [
      [
        "i0OFE",
        JSON.stringify([null, null, "BR", 0, "pt", TRENDS_SEO_HOURS, 1]),
        null,
        "generic",
      ],
    ],
  ]);

  const body = new URLSearchParams({ "f.req": fReq }).toString();
  const res = await fetch(TRENDS_SEO_BATCHEXECUTE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent":
        "Mozilla/5.0 (compatible; AppRedacaoTrends/1.0; +https://localhost)",
      Origin: "https://trends.google.com",
      Referer: "https://trends.google.com/trending?geo=BR&hl=pt-BR",
      Accept: "*/*",
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Google Trends batchexecute HTTP ${res.status}`);
  }

  const text = await res.text();
  const list = extractBatchexecuteList(text);
  const capturedAt = new Date().toISOString();
  const seen = new Set<string>();
  const noticias: TrendSeoItem[] = [];

  for (const row of list) {
    if (!Array.isArray(row)) continue;
    // Índice 10 = ids de categoria (ex.: 17 = Sports).
    if (hasExcludedCategory(row[10])) continue;

    const titulo = String(row[0] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!titulo) continue;
    const key = titulo.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);

    const volumeRaw = row[6];
    const volumeOrdenacao =
      typeof volumeRaw === "number" && Number.isFinite(volumeRaw)
        ? volumeRaw
        : typeof volumeRaw === "string"
          ? Number(String(volumeRaw).replace(/[^\d]/g, "")) || 0
          : 0;

    const startArr = row[3];
    const startSec =
      Array.isArray(startArr) && typeof startArr[0] === "number"
        ? startArr[0]
        : null;

    noticias.push({
      titulo,
      link: exploreUrl(titulo),
      fonte: "Google Trends",
      data_publicacao: capturedAt,
      publicado_em: unixSecondsToIso(startSec),
      destaque:
        volumeOrdenacao > 0 ? formatVolumeDestaque(volumeOrdenacao) : null,
      volumeOrdenacao,
    });
  }

  const limited = sortAndLimit(noticias);
  if (limited.length === 0) {
    throw new Error("Google Trends batchexecute retornou 0 itens.");
  }

  return {
    ok: true,
    noticias: limited,
    total: limited.length,
    geo: "BR",
    fonte: "google-trends-batchexecute",
  };
}

async function agregarViaRss(): Promise<TrendsSeoAgregadoOk> {
  const res = await fetch(TRENDS_SEO_RSS_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; AppRedacaoTrends/1.0; +https://localhost)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Google Trends RSS HTTP ${res.status}`);
  }

  const xml = await res.text();
  const parser = new Parser<Record<string, unknown>, TrendsRssItem>({
    defaultRSS: 2,
    customFields: {
      item: [["ht:approx_traffic", "approxTraffic"]],
    },
  });

  const feed = await parser.parseString(xml);
  const capturedAt = new Date().toISOString();
  const seen = new Set<string>();
  const noticias: TrendSeoItem[] = [];

  for (const item of feed.items ?? []) {
    const titulo = item.title?.replace(/\s+/g, " ").trim();
    if (!titulo) continue;
    if (looksLikeSportsTerm(titulo)) continue;
    const key = titulo.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);

    const { destaque, volumeOrdenacao } = parseTrafficVolume(item.approxTraffic);
    noticias.push({
      titulo,
      link: exploreUrl(titulo),
      fonte: "Google Trends",
      data_publicacao: capturedAt,
      publicado_em: pubDateToIso(item),
      destaque,
      volumeOrdenacao,
    });
  }

  const limited = sortAndLimit(noticias);
  return {
    ok: true,
    noticias: limited,
    total: limited.length,
    geo: "BR",
    fonte: "google-trends-rss",
  };
}

/** Busca e normaliza os assuntos em alta no Brasil (descoberta SEO). */
export async function agregarTrendsSeo(): Promise<TrendsSeoAgregadoOk> {
  try {
    return await agregarViaBatchexecute();
  } catch (e) {
    console.warn(
      "[trends-seo] batchexecute falhou; tentando RSS.",
      e instanceof Error ? e.message : e
    );
    return agregarViaRss();
  }
}
