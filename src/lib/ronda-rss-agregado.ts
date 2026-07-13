import Parser from "rss-parser";

/** Um feed lógico por fonte; `rssFallbackUrls` são tentados em ordem até completar o limite de itens. */
export type RondaRssFeedConfig = {
  fonte: string;
  rssUrl: string;
  rssFallbackUrls?: string[];
  /** Google Notícias: exibe o veículo após " - " no título em vez de `fonte`. */
  fonteDoTituloGoogleNews?: boolean;
};

export type RondaRssKind = "gov" | "tech" | "inss" | "longevidade";

export const RONDA_RSS_FEEDS_GOV: RondaRssFeedConfig[] = [
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
    /** O feed “últimas” do portal às vezes vem sem `<item>`; os temáticos seguem populados. */
    rssFallbackUrls: [
      "https://www.camara.leg.br/noticias/rss/dinamico/POLITICA",
      "https://www.camara.leg.br/noticias/rss/dinamico/ECONOMIA",
      "https://www.camara.leg.br/noticias/rss/dinamico/TRABALHO-E-PREVIDENCIA",
      "https://www.camara.leg.br/noticias/rss/dinamico/SAUDE",
    ],
  },
  {
    rssUrl: "https://www12.senado.leg.br/noticias/RSS",
    fonte: "Senado Federal",
  },
];

/** Alias histórico: mesma lista que `RONDA_RSS_FEEDS_GOV`. */
export const RONDA_RSS_FEEDS = RONDA_RSS_FEEDS_GOV;

/** Feed principal do TudoCelular (`/rss.xml` 404); usa o XML do site. */
export const RONDA_RSS_FEEDS_INSS: RondaRssFeedConfig[] = [
  {
    rssUrl:
      "https://news.google.com/rss/search?q=INSS&hl=pt-BR&gl=BR&ceid=BR:pt-419",
    fonte: "Google Notícias — INSS",
    fonteDoTituloGoogleNews: true,
  },
  {
    rssUrl:
      "https://news.google.com/rss/search?q=previd%C3%AAncia%20social&hl=pt-BR&gl=BR&ceid=BR%3Apt-419",
    fonte: "Google Notícias — Previdência Social",
    fonteDoTituloGoogleNews: true,
  },
  {
    rssUrl:
      "https://news.google.com/rss/search?q=aposentadoria&hl=pt-BR&gl=BR&ceid=BR%3Apt-419",
    fonte: "Google Notícias — Aposentadoria",
    fonteDoTituloGoogleNews: true,
  },
  {
    rssUrl:
      "https://news.google.com/rss/search?q=aposentados&hl=pt-BR&gl=BR&ceid=BR%3Apt-419",
    fonte: "Google Notícias — Aposentados",
    fonteDoTituloGoogleNews: true,
  },
];

export const RONDA_RSS_FEEDS_LONGEVIDADE: RondaRssFeedConfig[] = [
  {
    rssUrl:
      "https://news.google.com/rss/search?q=longevidade&hl=pt-BR&gl=BR&ceid=BR%3Apt-419",
    fonte: "Google Notícias — Longevidade",
    fonteDoTituloGoogleNews: true,
  },
  {
    rssUrl:
      "https://news.google.com/rss/search?q=saude%20terceira%20idade&hl=pt-BR&gl=BR&ceid=BR%3Apt-419",
    fonte: "Google Notícias — Saúde Terceira Idade",
    fonteDoTituloGoogleNews: true,
  },
  {
    rssUrl:
      "https://news.google.com/rss/search?q=terceira%20idade&hl=pt-BR&gl=BR&ceid=BR%3Apt-419",
    fonte: "Google Notícias — Terceira Idade",
    fonteDoTituloGoogleNews: true,
  },
  {
    rssUrl:
      "https://news.google.com/rss/search?q=velhice&hl=pt-BR&gl=BR&ceid=BR%3Apt-419",
    fonte: "Google Notícias — Velhice",
    fonteDoTituloGoogleNews: true,
  },
];

export const RONDA_RSS_FEEDS_TECH: RondaRssFeedConfig[] = [
  {
    rssUrl: "https://www.tudocelular.com/feed/",
    fonte: "TudoCelular",
  },
  {
    rssUrl: "https://g1.globo.com/rss/g1/tecnologia/",
    fonte: "G1 Tecnologia",
  },
  {
    rssUrl: "https://feeds.folha.uol.com.br/tec/rss091.xml",
    fonte: "Folha — Tecnologia",
  },
  {
    rssUrl: "https://rss.tecmundo.com.br/feed",
    fonte: "TecMundo",
  },
  {
    rssUrl: "https://www.techtudo.com.br/rss/techtudo/",
    fonte: "TechTudo",
  },
  {
    rssUrl: "https://canaltech.com.br/RSS/",
    fonte: "Canaltech",
  },
  {
    rssUrl: "https://tecnoblog.net/feed/",
    fonte: "Tecnoblog",
  },
  {
    rssUrl: "https://olhardigital.com.br/editorias/noticias/feed/",
    fonte: "Olhar Digital",
  },
];

const FEEDS_POR_KIND: Record<RondaRssKind, RondaRssFeedConfig[]> = {
  gov: RONDA_RSS_FEEDS_GOV,
  tech: RONDA_RSS_FEEDS_TECH,
  inss: RONDA_RSS_FEEDS_INSS,
  longevidade: RONDA_RSS_FEEDS_LONGEVIDADE,
};

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

function fonteGoogleNewsDoTitulo(titulo: string, fallback: string): string {
  const idx = titulo.lastIndexOf(" - ");
  if (idx === -1) return fallback;
  const veiculo = titulo.slice(idx + 3).trim();
  return veiculo || fallback;
}

function normalizarTituloDedup(titulo: string): string {
  return titulo
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Remove repetidas entre feeds (mesmo link ou mesmo título); mantém a mais recente. */
function deduplicarPorLinkETitulo(itens: ItemRonda[]): ItemRonda[] {
  const vistosLink = new Set<string>();
  const vistosTitulo = new Set<string>();
  const out: ItemRonda[] = [];
  for (const it of itens) {
    const tituloKey = normalizarTituloDedup(it.titulo);
    if (vistosLink.has(it.link) || vistosTitulo.has(tituloKey)) continue;
    vistosLink.add(it.link);
    vistosTitulo.add(tituloKey);
    out.push(it);
  }
  return out;
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
  nextPuxada: () => { ordem: number; data_publicacao: string },
  maxItens: number = ITENS_POR_FONTE,
  fonteDoTituloGoogleNews = false
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
    if (out.length >= maxItens) break;
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
      fonte: fonteDoTituloGoogleNews
        ? fonteGoogleNewsDoTitulo(titulo, fonte)
        : fonte,
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

async function buscarCorpoRss(
  rssUrl: string,
  fonte: string
): Promise<{ text: string | null; baseUrl: string }> {
  let baseUrl: string;
  try {
    baseUrl = new URL(rssUrl).origin;
  } catch {
    console.error(`[ronda-rss] URL inválida (${fonte}):`, rssUrl);
    return { text: null, baseUrl: "" };
  }
  try {
    const res = await fetch(rssUrl, {
      headers: FETCH_HEADERS,
      redirect: "follow",
    });
    if (!res.ok) {
      console.error(`[ronda-rss] HTTP ${res.status} (${fonte}) — ${rssUrl}`);
      return { text: null, baseUrl };
    }
    const text = await res.text();
    return { text, baseUrl };
  } catch (e) {
    console.error(`[ronda-rss] Falha ao buscar (${fonte}) — ${rssUrl}:`, e);
    return { text: null, baseUrl };
  }
}

async function coletarItensUmaFonte(
  config: RondaRssFeedConfig,
  nextPuxada: () => { ordem: number; data_publicacao: string }
): Promise<ItemRonda[]> {
  const urls = [config.rssUrl, ...(config.rssFallbackUrls ?? [])];
  const merged: ItemRonda[] = [];
  const vistos = new Set<string>();

  for (const url of urls) {
    if (merged.length >= ITENS_POR_FONTE) break;
    const { text, baseUrl } = await buscarCorpoRss(url, config.fonte);
    if (!text || !baseUrl) continue;
    const itens = await extrairItensRss(
      text,
      config.fonte,
      baseUrl,
      nextPuxada,
      ITENS_POR_FONTE,
      config.fonteDoTituloGoogleNews
    );
    for (const it of itens) {
      if (vistos.has(it.link)) continue;
      vistos.add(it.link);
      merged.push(it);
      if (merged.length >= ITENS_POR_FONTE) break;
    }
  }

  return merged;
}

/** Resposta JSON do Radar de Pautas (`/api/ronda-rss`) e do snapshot no Supabase. */
export type RondaRssAgregadoOk = {
  ok: true;
  noticias: {
    titulo: string;
    link: string;
    fonte: string;
    data_publicacao: string;
    publicado_em: string | null;
  }[];
  total: number;
};

export async function agregarRondaRss(
  kind: RondaRssKind = "gov"
): Promise<RondaRssAgregadoOk> {
  const feeds = FEEDS_POR_KIND[kind];
  const nextPuxada = criarSequenciaPuxada();
  const porFonte = await Promise.all(
    feeds.map((config) => coletarItensUmaFonte(config, nextPuxada))
  );
  const todasNoticias = porFonte.flat();

  todasNoticias.sort(ordenarComoRonda);
  const unicas = deduplicarPorLinkETitulo(todasNoticias);

  const noticias = unicas.map(
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
