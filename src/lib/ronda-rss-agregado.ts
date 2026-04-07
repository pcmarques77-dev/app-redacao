import Parser from "rss-parser";

export const RONDA_RSS_FEEDS: { rssUrl: string; fonte: string }[] = [
  {
    rssUrl: "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml",
    fonte: "Agência Brasil",
  },
  {
    rssUrl: "https://agenciagov.ebc.com.br/search_rss",
    fonte: "Agência Gov",
  },
  {
    rssUrl: "https://www.agenciasp.sp.gov.br/feed/",
    fonte: "Agência SP",
  },
  {
    rssUrl: "https://www.camara.leg.br/noticias/rss/ultimas-noticias",
    fonte: "Câmara dos Deputados",
  },
  {
    rssUrl: "https://www12.senado.leg.br/noticias/RSS",
    fonte: "Senado Federal",
  },
];

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
      `[ronda-rss] RSS (${fonte}): corpo vazio ou não-XML (WAF/HTML?).`
    );
    return [];
  }

  let feed: Awaited<ReturnType<Parser["parseString"]>>;
  try {
    const parser = new Parser();
    feed = await parser.parseString(xml);
  } catch (e) {
    console.error(`[ronda-rss] RSS (${fonte}): falha ao interpretar XML:`, e);
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
    // RSS 1.0 / RDF (ex.: Agência Gov) expõe `dc:date` como `date` no rss-parser
    if (publicadoEm == null && "date" in item && typeof item.date === "string") {
      const d = new Date(item.date);
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

/** Mesma regra de ordenação que `/api/ronda` (datas no site; desempate por `ordem`). */
function ordenarComoRonda(a: ItemRonda, b: ItemRonda): number {
  const pa = a.publicado_em?.getTime();
  const pb = b.publicado_em?.getTime();
  if (pa != null && pb != null) {
    const d = pb - pa;
    return d !== 0 ? d : b.ordem - a.ordem;
  }
  if (pa != null && pb == null) return -1;
  if (pa == null && pb != null) return 1;
  return b.ordem - a.ordem;
}

export async function agregarRondaRss(): Promise<{
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
    RONDA_RSS_FEEDS.map(async ({ rssUrl, fonte }) => {
      let baseUrl: string;
      try {
        baseUrl = new URL(rssUrl).origin;
      } catch {
        console.error(`[ronda-rss] URL inválida (${fonte}):`, rssUrl);
        return { fonte, html: null as string | null, baseUrl: "" };
      }
      try {
        const res = await fetch(rssUrl, {
          headers: FETCH_HEADERS,
          redirect: "follow",
        });
        if (!res.ok) {
          console.error(`[ronda-rss] HTTP ${res.status} (${fonte}) — ${rssUrl}`);
          return { fonte, html: null, baseUrl };
        }
        const html = await res.text();
        return { fonte, html, baseUrl };
      } catch (e) {
        console.error(`[ronda-rss] Falha ao buscar (${fonte}) — ${rssUrl}:`, e);
        return { fonte, html: null, baseUrl };
      }
    })
  );

  const todasNoticias: ItemRonda[] = [];
  const nextPuxada = criarSequenciaPuxada();

  for (const { fonte, html, baseUrl } of fetched) {
    if (!html || !baseUrl) continue;
    const itens = await extrairItensRss(html, fonte, baseUrl, nextPuxada);
    todasNoticias.push(...itens);
  }

  todasNoticias.sort(ordenarComoRonda);

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
