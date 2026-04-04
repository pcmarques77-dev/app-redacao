import * as cheerio from "cheerio";
import type { Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
import {
  SCRAPERS_GOVERNO,
  type GovernoScraperConfig,
} from "@/lib/feeds-governo";
import { unstable_cache } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import Parser from "rss-parser";

export const maxDuration = 120;

const ITENS_POR_FONTE = 10;

const FETCH_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};

function absolutizarUrl(baseUrl: string, href: string): string | null {
  const t = href.trim();
  if (!t || t === "#" || t.startsWith("javascript:")) return null;
  try {
    return new URL(t, baseUrl).href;
  } catch {
    return null;
  }
}

/** Ex.: "sex, 03/04/2026 - 08:41" */
function parseDataAgenciaBrasil(text: string): Date | null {
  const m = text.match(
    /(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2}):(\d{2})/
  );
  if (!m) return null;
  const [, d, mo, y, h, min] = m;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(min)
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Ex.: "02/04/2026" (sem hora na listagem — usa meio-dia local). */
function parseDataDdMmYyyy(text: string): Date | null {
  const m = text.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), 12, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Ex.: "02/04/2026 19:31" */
function parseDataDdMmYyyyHhMm(text: string): Date | null {
  const m = text
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, d, mo, y, h, min] = m;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(min)
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Ex.: `span.documentByLine` em tiles NITF do gov.br — "… 03/04/2026 21h59 …". */
function parseDataDdMmYyyyHhMmGovBr(text: string): Date | null {
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2})h(\d{2})/);
  if (!m) return null;
  const [, d, mo, y, h, min] = m;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(min)
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Listagem "Últimas" da Câmara: texto do link começa com "01/04 18h29" (sem ano).
 * Usa o ano civil corrente e, se a data ficar muito no futuro, assume ano anterior.
 */
function parseDataCamaraUltimas(text: string): Date | null {
  const m = text.trim().match(/^(\d{2})\/(\d{2})\s+(\d{2})h(\d{2})\b/);
  if (!m) return null;
  const [, d, mo, h, min] = m;
  let y = new Date().getFullYear();
  let date = new Date(y, Number(mo) - 1, Number(d), Number(h), Number(min));
  if (Number.isNaN(date.getTime())) return null;
  if (date.getTime() > Date.now() + 2 * 86400000) {
    y -= 1;
    date = new Date(y, Number(mo) - 1, Number(d), Number(h), Number(min));
  }
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDataPublicacao(fonte: string, dataText: string): Date | null {
  const t = dataText.trim();
  if (!t) return null;
  if (/^\d+\s+dia/i.test(t) || /atrás/i.test(t)) return null;
  switch (fonte) {
    case "Agência Brasil":
      return parseDataAgenciaBrasil(t);
    case "Agência Gov":
      return parseDataDdMmYyyyHhMm(t) ?? parseDataDdMmYyyy(t);
    case "Receita Federal":
      return parseDataDdMmYyyy(t);
    case "STF":
      return parseDataDdMmYyyyHhMm(t);
    case "Agência SP":
      return (
        parseDataAgenciaBrasil(t) ??
        parseDataDdMmYyyyHhMm(t) ??
        parseDataDdMmYyyy(t)
      );
    case "Polícia Federal":
    case "INSS":
      return parseDataDdMmYyyyHhMmGovBr(t);
    case "Câmara dos Deputados":
      return parseDataCamaraUltimas(t);
    default:
      return null;
  }
}

function extrairPublicadoEmSite(
  $c: Cheerio<AnyNode>,
  fonte: string,
  dataSelector?: string
): Date | null {
  if (!dataSelector) return null;
  const $d = $c.find(dataSelector).first();
  if (!$d.length) return null;
  const fromAttr = $d.attr("datetime")?.trim();
  if (fromAttr) {
    const d = new Date(fromAttr);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return parseDataPublicacao(fonte, $d.text());
}

/** Instant da captura + sequência (desempate quando não há data no site). */
function criarSequenciaPuxada() {
  let seq = 0;
  return () => {
    const ms = Date.now();
    seq += 1;
    return {
      ordem: ms * 10_000 + seq,
      data_publicacao: new Date(ms).toISOString(),
    };
  };
}

function extrairNoticiasDoHtml(
  config: GovernoScraperConfig,
  html: string,
  baseUrl: string,
  nextPuxada: () => { ordem: number; data_publicacao: string }
): {
  titulo: string;
  link: string;
  fonte: string;
  data_publicacao: string;
  publicado_em: Date | null;
  ordem: number;
}[] {
  const { seletores } = config;
  if (!seletores) return [];

  const $ = cheerio.load(html);
  const out: {
    titulo: string;
    link: string;
    fonte: string;
    data_publicacao: string;
    publicado_em: Date | null;
    ordem: number;
  }[] = [];

  $(seletores.container).each((_, el) => {
    if (out.length >= ITENS_POR_FONTE) return false;

    const $c = $(el);
    const $linkEl = $c.find(seletores.link).first();
    const $tituloEl = $c.find(seletores.titulo).first();

    let href = ($linkEl.attr("href") ?? "").trim();
    if (!href && $tituloEl.length && $tituloEl.is("a")) {
      href = ($tituloEl.attr("href") ?? "").trim();
    }

    const abs = absolutizarUrl(baseUrl, href);
    if (!abs) return;

    const tituloRaw =
      ($tituloEl.length ? $tituloEl : $linkEl).text().trim() ||
      $linkEl.text().trim();
    let titulo = tituloRaw.replace(/\s+/g, " ");
    if (config.fonte === "Câmara dos Deputados") {
      titulo = titulo.replace(/^\d{2}\/\d{2}\s+\d{2}h\d{2}\s+/i, "").trim();
    }
    if (!titulo) return;

    const publicadoEm = extrairPublicadoEmSite(
      $c,
      config.fonte,
      seletores.data
    );

    const { ordem, data_publicacao } = nextPuxada();

    out.push({
      titulo,
      link: abs,
      fonte: config.fonte,
      data_publicacao,
      publicado_em: publicadoEm,
      ordem,
    });
    return undefined;
  });

  return out;
}

type ItemRonda = {
  titulo: string;
  link: string;
  fonte: string;
  data_publicacao: string;
  publicado_em: Date | null;
  ordem: number;
};

async function extrairItensRss(
  xml: string,
  fonte: string,
  baseUrl: string,
  nextPuxada: () => { ordem: number; data_publicacao: string }
): Promise<ItemRonda[]> {
  const trimmed = xml.trim();
  if (!trimmed || !trimmed.startsWith("<")) {
    console.error(
      `[ronda] RSS (${fonte}): corpo vazio ou não-XML (WAF/HTML?).`
    );
    return [];
  }

  let feed: Awaited<ReturnType<Parser["parseString"]>>;
  try {
    const parser = new Parser();
    feed = await parser.parseString(xml);
  } catch (e) {
    console.error(`[ronda] RSS (${fonte}): falha ao interpretar XML:`, e);
    return [];
  }

  const out: ItemRonda[] = [];
  for (const item of feed.items ?? []) {
    if (out.length >= ITENS_POR_FONTE) break;
    const titulo = item.title?.replace(/\s+/g, " ").trim();
    const href = item.link?.trim();
    if (!titulo || !href) continue;
    const abs = absolutizarUrl(baseUrl, href) ?? href;

    let publicadoEm: Date | null = null;
    if (item.isoDate) {
      const d = new Date(item.isoDate);
      if (!Number.isNaN(d.getTime())) publicadoEm = d;
    }
    if (publicadoEm == null && item.pubDate) {
      const d = new Date(item.pubDate);
      if (!Number.isNaN(d.getTime())) publicadoEm = d;
    }

    const { ordem, data_publicacao } = nextPuxada();
    out.push({
      titulo,
      link: abs,
      fonte,
      data_publicacao,
      publicado_em: publicadoEm,
      ordem,
    });
  }
  return out;
}

/** Fetches em paralelo; parsing na ordem de SCRAPERS_GOVERNO (mantém `ordem` coerente). */
async function scrapeRondaNoticias(): Promise<{
  ok: true;
  noticias: {
    titulo: string;
    link: string;
    fonte: string;
    data_publicacao: string;
    publicado_em: string | null;
  }[];
  total: number;
}> {
  const fetched = await Promise.all(
    SCRAPERS_GOVERNO.map(async (config) => {
      let baseUrl: string;
      try {
        baseUrl = new URL(config.url).origin;
      } catch {
        console.error(`[ronda] URL inválida (${config.fonte}):`, config.url);
        return { config, html: null as string | null, baseUrl: "" };
      }
      const fetchUrl = config.rssUrl ?? config.url;
      try {
        const res = await fetch(fetchUrl, {
          headers: FETCH_HEADERS,
          redirect: "follow",
        });
        if (!res.ok) {
          console.error(
            `[ronda] HTTP ${res.status} (${config.fonte}) — ${fetchUrl}`
          );
          return { config, html: null, baseUrl };
        }
        const html = await res.text();
        return { config, html, baseUrl };
      } catch (e) {
        console.error(
          `[ronda] Falha ao raspar (${config.fonte}) — ${fetchUrl}:`,
          e
        );
        return { config, html: null, baseUrl };
      }
    })
  );

  const todasNoticias: ItemRonda[] = [];
  const nextPuxada = criarSequenciaPuxada();

  for (const { config, html, baseUrl } of fetched) {
    if (!html || !baseUrl) continue;
    if (config.rssUrl) {
      const itens = await extrairItensRss(
        html,
        config.fonte,
        baseUrl,
        nextPuxada
      );
      todasNoticias.push(...itens);
      continue;
    }
    const extraidas = extrairNoticiasDoHtml(
      config,
      html,
      baseUrl,
      nextPuxada
    );
    todasNoticias.push(...extraidas);
  }

  todasNoticias.sort((a, b) => {
    const pa = a.publicado_em?.getTime();
    const pb = b.publicado_em?.getTime();
    if (pa != null && pb != null) {
      const d = pb - pa;
      return d !== 0 ? d : b.ordem - a.ordem;
    }
    if (pa != null && pb == null) return -1;
    if (pa == null && pb != null) return 1;
    return b.ordem - a.ordem;
  });

  const noticias = todasNoticias.map(
    ({ titulo, link, fonte, data_publicacao, publicado_em }) => ({
      titulo,
      link,
      fonte,
      data_publicacao,
      publicado_em: publicado_em?.toISOString() ?? null,
    })
  );

  return {
    ok: true,
    noticias,
    total: noticias.length,
  };
}

const getRondaCached = unstable_cache(scrapeRondaNoticias, ["ronda-scrape-v2"], {
  revalidate: 90,
});

export async function GET(request: NextRequest) {
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  try {
    const data = refresh ? await scrapeRondaNoticias() : await getRondaCached();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[ronda]", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao montar a ronda." },
      { status: 500 }
    );
  }
}
