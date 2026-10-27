import * as cheerio from "cheerio";
import { unstable_cache } from "next/cache";

/**
 * Índice das reportagens publicadas em viva.com.br.
 * O portal não tem editoria "Últimas Notícias". O RSS (`/feed`) só traz as
 * 30 mais recentes — menos de um dia. As listagens de canal paginam com
 * título, linha-fina, repórter e data, e é daí que sai a semana.
 */

const ORIGIN = "https://viva.com.br";
const FUSO = "America/Sao_Paulo";
/** Brasília permanece em UTC−3 (sem horário de verão). */
const OFFSET_BRASILIA_HORAS = 3;
export const ULTIMAS_DIAS = 7;
const MAX_PAGINAS_POR_CANAL = 30;
const REVALIDATE_SEGUNDOS = 180;

const CANAIS: { slug: string; nome: string }[] = [
  { slug: "noticias", nome: "Acontece" },
  { slug: "politica", nome: "Política" },
  { slug: "cidadania-e-direitos", nome: "Cidadania e Direitos" },
  { slug: "dinheiro", nome: "Dinheiro" },
  { slug: "saude-e-bem-estar", nome: "Saúde e Bem-estar" },
  { slug: "cultura-e-lazer", nome: "Cultura e Lazer" },
  { slug: "carreira-e-educacao", nome: "Carreira e Educação" },
  { slug: "estilo-de-vida", nome: "Estilo de Vida" },
  { slug: "viagem", nome: "Viagem" },
  { slug: "tecnologia", nome: "Tecnologia" },
  { slug: "esportes", nome: "Esportes" },
];

const EDITORIA_POR_SECAO: Record<string, string> = Object.fromEntries(
  CANAIS.map((canal) => [canal.slug, canal.nome])
);

const FETCH_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};

export type UltimaReportagem = {
  titulo: string;
  subtitulo: string | null;
  link: string;
  editoria: string;
  autor: string | null;
  publicadoEm: string;
};

export type UltimasVivaOk = {
  ok: true;
  itens: UltimaReportagem[];
  editorias: string[];
  desde: string;
  atualizadoEm: string;
  avisos: string[];
};

export type UltimasVivaResult =
  | UltimasVivaOk
  | { ok: false; error: string };

function texto(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function diaEmSaoPaulo(data: Date): { ano: number; mes: number; dia: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);
  const ler = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((parte) => parte.type === tipo)?.value);
  return { ano: ler("year"), mes: ler("month"), dia: ler("day") };
}

/** Meia-noite do primeiro dia do histórico (7 dias corridos, incluindo hoje). */
export function inicioHistoricoUltimas(agora = new Date()): Date {
  const { ano, mes, dia } = diaEmSaoPaulo(agora);
  return new Date(
    Date.UTC(ano, mes - 1, dia - (ULTIMAS_DIAS - 1), OFFSET_BRASILIA_HORAS, 0, 0)
  );
}

function parseDataListagem(raw: string): Date | null {
  const match = raw.match(
    /(\d{2})\/(\d{2})\/(\d{4})\s*\|\s*(\d{1,2})h(\d{2})/
  );
  if (!match) return null;
  const dia = Number(match[1]);
  const mes = Number(match[2]);
  const ano = Number(match[3]);
  const hora = Number(match[4]);
  const minuto = Number(match[5]);
  const data = new Date(
    Date.UTC(ano, mes - 1, dia, hora + OFFSET_BRASILIA_HORAS, minuto, 0)
  );
  return Number.isNaN(data.getTime()) ? null : data;
}

function linkReportagem(href: string): { link: string; editoria: string } | null {
  let url: URL;
  try {
    url = new URL(href, ORIGIN);
  } catch {
    return null;
  }
  if (url.hostname !== "viva.com.br" && url.hostname !== "www.viva.com.br") {
    return null;
  }
  const match = url.pathname.match(/^\/([a-z0-9-]+)\/[a-z0-9-]+\.html$/);
  if (!match) return null;
  url.protocol = "https:";
  url.hostname = "viva.com.br";
  url.search = "";
  url.hash = "";
  return {
    link: url.href,
    editoria: EDITORIA_POR_SECAO[match[1]] ?? match[1],
  };
}

function parseListagem(html: string): {
  titulo: string;
  subtitulo: string | null;
  link: string;
  editoria: string;
  autor: string | null;
  publicadoEm: Date;
}[] {
  const $ = cheerio.load(html);
  const itens: {
    titulo: string;
    subtitulo: string | null;
    link: string;
    editoria: string;
    autor: string | null;
    publicadoEm: Date;
  }[] = [];

  $("a.listagem_principal, a.listagem_item").each((_, el) => {
    const card = $(el);
    const destino = linkReportagem(card.attr("href") ?? "");
    const titulo = texto(card.find("h2").first().text());
    const publicadoEm = parseDataListagem(
      texto(card.find(".listagem_meta__data").first().text())
    );
    if (!destino || !titulo || !publicadoEm) return;
    const subtitulo = texto(
      card
        .find(".listagem_principal__subtitulo, .listagem_item__subtitulo")
        .first()
        .text()
    );
    const autor = texto(card.find(".listagem_meta__autor").first().text());
    itens.push({
      titulo,
      subtitulo: subtitulo || null,
      link: destino.link,
      editoria: destino.editoria,
      autor: autor || null,
      publicadoEm,
    });
  });

  return itens;
}

function temProximaPagina(html: string): boolean {
  const $ = cheerio.load(html);
  const href = $(".listagem_mostrar_mais a").attr("href") ?? "";
  return /[?&]page=\d+/.test(href);
}

async function lerPagina(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function coletarCanal(
  canal: { slug: string; nome: string },
  corte: Date
): Promise<{ itens: UltimaReportagem[]; aviso: string | null }> {
  const itens: UltimaReportagem[] = [];
  const vistos = new Set<string>();

  for (let pagina = 1; pagina <= MAX_PAGINAS_POR_CANAL; pagina += 1) {
    const html = await lerPagina(
      `${ORIGIN}/canal/${canal.slug}?page=${pagina}`
    );
    if (html == null) {
      if (itens.length === 0) {
        return { itens, aviso: `${canal.nome} não entrou nesta leitura.` };
      }
      return {
        itens,
        aviso: `${canal.nome} ficou incompleta nesta leitura.`,
      };
    }

    const parsed = parseListagem(html);
    if (parsed.length === 0) {
      return {
        itens,
        aviso:
          pagina === 1 ? `${canal.nome} não entrou nesta leitura.` : null,
      };
    }

    let acrescentou = 0;
    let passouDoCorte = false;
    for (const item of parsed) {
      if (item.publicadoEm.getTime() < corte.getTime()) {
        passouDoCorte = true;
        continue;
      }
      if (vistos.has(item.link)) continue;
      vistos.add(item.link);
      acrescentou += 1;
      itens.push({
        titulo: item.titulo,
        subtitulo: item.subtitulo,
        link: item.link,
        editoria: item.editoria,
        autor: item.autor,
        publicadoEm: item.publicadoEm.toISOString(),
      });
    }

    if (!temProximaPagina(html) || passouDoCorte || acrescentou === 0) break;
  }

  return { itens, aviso: null };
}

export async function coletarUltimasReportagens(
  agora = new Date()
): Promise<UltimasVivaResult> {
  const corte = inicioHistoricoUltimas(agora);
  const porCanal = await Promise.all(
    CANAIS.map((canal) => coletarCanal(canal, corte))
  );

  const porLink = new Map<string, UltimaReportagem>();
  const avisos: string[] = [];
  for (const resultado of porCanal) {
    if (resultado.aviso) avisos.push(resultado.aviso);
    for (const item of resultado.itens) {
      const anterior = porLink.get(item.link);
      if (
        !anterior ||
        item.publicadoEm.localeCompare(anterior.publicadoEm) > 0
      ) {
        porLink.set(item.link, item);
      }
    }
  }

  const itens = [...porLink.values()].sort((a, b) => {
    const porData = b.publicadoEm.localeCompare(a.publicadoEm);
    if (porData !== 0) return porData;
    return a.titulo.localeCompare(b.titulo, "pt-BR");
  });

  if (itens.length === 0) {
    return {
      ok: false,
      error: avisos.length
        ? "Não foi possível ler as reportagens publicadas no Viva."
        : "Nenhuma reportagem publicada no Viva nos últimos 7 dias.",
    };
  }

  const presentes = new Set(itens.map((item) => item.editoria));
  const editorias = CANAIS.map((canal) => canal.nome).filter((nome) =>
    presentes.has(nome)
  );
  for (const item of itens) {
    if (!editorias.includes(item.editoria)) editorias.push(item.editoria);
  }

  return {
    ok: true,
    itens,
    editorias,
    desde: corte.toISOString(),
    atualizadoEm: agora.toISOString(),
    avisos,
  };
}

const lerUltimasEmCache = unstable_cache(
  async () => {
    const res = await coletarUltimasReportagens();
    if (!res.ok) throw new Error(res.error);
    return res;
  },
  ["viva-ultimas-v1"],
  { revalidate: REVALIDATE_SEGUNDOS }
);

export async function listarUltimasViva(): Promise<UltimasVivaResult> {
  try {
    return await lerUltimasEmCache();
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message.includes("Nenhuma reportagem publicada no Viva nos últimos 7 dias.")) {
      return {
        ok: false,
        error: "Nenhuma reportagem publicada no Viva nos últimos 7 dias.",
      };
    }
    return {
      ok: false,
      error: "Não foi possível ler as reportagens publicadas no Viva.",
    };
  }
}
