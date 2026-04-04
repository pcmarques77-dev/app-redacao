/** Seletores Cheerio para a Ronda (API /api/ronda). */
export type GovernoScraperSeletores = {
  container: string;
  titulo: string;
  link: string;
  /** Texto ou elemento `time[datetime]` com a data/hora no site (opcional). */
  data?: string;
};

export type GovernoScraperConfig = {
  fonte: string;
  /** URL canônica (origem para links relativos e metadados). */
  url: string;
  /** Obrigatório quando não há `rssUrl` (raspagem HTML com Cheerio). */
  seletores?: GovernoScraperSeletores;
  /**
   * Feed RSS oficial (ex.: WordPress). Evita HTML bloqueado por WAF e não depende de terceiros.
   */
  rssUrl?: string;
};

/** `url` = página de listagem para raspagem HTML. */
export const SCRAPERS_GOVERNO: GovernoScraperConfig[] = [
  {
    fonte: "Agência Brasil",
    url: "https://agenciabrasil.ebc.com.br/ultimas",
    seletores: {
      container: ".ultima-noticia",
      titulo: "a.titulo-noticia",
      link: "a.titulo-noticia",
      data: ".data-publicacao .data",
    },
  },
  {
    fonte: "Agência Gov",
    url: "https://agenciagov.ebc.com.br/noticias",
    seletores: {
      container: "ul.demais-noticias > li",
      titulo: ".titulo-noticia",
      link: "a",
      data: ".data-noticia",
    },
  },
  {
    fonte: "Senado Federal",
    url: "https://www12.senado.leg.br/noticias/ultimas",
    seletores: {
      container: "#ultimas ul.f3 > li",
      titulo: "a.Link--text",
      link: "a.Link--text",
    },
  },
  {
    fonte: "Receita Federal",
    url: "https://www.gov.br/receitafederal/pt-br/assuntos/noticias",
    seletores: {
      container: "ul.listagem-noticias-com-foto > li",
      titulo: "h2.titulo a",
      link: "h2.titulo a",
      data: "span.descricao span.data",
    },
  },
  {
    fonte: "Câmara dos Deputados",
    url: "https://www.camara.leg.br/noticias",
    seletores: {
      container: ".ultimas-noticias .l-lista-noticias li",
      titulo: "a.g-chamada__titulo-link",
      link: "a.g-chamada__titulo-link",
      data: "a.g-chamada__titulo-link",
    },
  },
  {
    fonte: "Polícia Federal",
    url: "https://www.gov.br/pf/pt-br/assuntos/noticias/ultimas-noticias",
    seletores: {
      container: ".tile-collective-nitf-content",
      titulo: "h2 a",
      link: "h2 a",
      data: "span.documentByLine",
    },
  },
  {
    fonte: "INSS",
    url: "https://www.gov.br/inss/pt-br/noticias",
    seletores: {
      container: ".tile-collective-nitf-content",
      titulo: "h2 a",
      link: "h2 a",
      data: "span.documentByLine",
    },
  },
  {
    fonte: "Ministério da Previdência Social",
    url: "https://www.gov.br/previdencia/pt-br",
    seletores: {
      container: '.tile-default:has(a[href*="/noticias/"])',
      titulo: 'a[href*="/noticias/"]',
      link: 'a[href*="/noticias/"]',
    },
  },
  {
    fonte: "Agência SP",
    url: "https://www.agenciasp.sp.gov.br/noticias/",
    seletores: {
      container: ".e-loop-item",
      titulo: "h3 a",
      link: "h3 a",
      data: "time",
    },
  },
  {
    fonte: "STF",
    url: "https://noticias.stf.jus.br/",
    rssUrl: "https://noticias.stf.jus.br/feed/",
  },
];
