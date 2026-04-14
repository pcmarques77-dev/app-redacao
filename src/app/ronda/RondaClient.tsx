"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FonteLogo } from "./FonteLogo";

type NoticiaRonda = {
  titulo: string;
  link: string;
  fonte: string;
  data_publicacao: string;
  publicado_em: string | null;
};

function formatRelativePast(iso: string): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const diffMs = Date.now() - ms;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 15) return "agora";
  if (sec < 60) return `há ${sec} s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} minuto${min === 1 ? "" : "s"}`;
  const h = Math.floor(min / 60);
  return `há ${h} hora${h === 1 ? "" : "s"}`;
}

function formatPublicadoNoSite(iso: string | null): string {
  if (!iso) return "Data no site indisponível";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Data no site indisponível";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type RondaClientProps = {
  /** Título principal do cabeçalho (ex.: /ronda-rss ou /radar-pautas). */
  pageTitle?: string;
  /** Endpoint JSON com o mesmo formato de `/api/ronda`. */
  apiPath?: string;
  /** Busca a lista ao abrir ou recarregar a página. */
  autoLoadOnMount?: boolean;
  /** Texto do botão de atualização manual. */
  atualizarLabel?: string;
  /** Se true, o título do card abre a matéria (sem botão “Ler Matéria”). */
  tituloEhLink?: boolean;
  /** Parágrafo explicativo sob o título (ex.: /ronda-rss sem texto). */
  showHeaderDescription?: boolean;
  /** Barra Calendário / Radar de Pautas / Escala / Nova Pauta (como no Admin). */
  showMainNavRow?: boolean;
  /** Com `showMainNavRow`, troca o 2.º link para Admin em vez de Radar de Pautas. */
  mainNavSecondIsAdmin?: boolean;
};

export function RondaClient({
  pageTitle = "Ronda Semiautomática",
  apiPath = "/api/ronda",
  autoLoadOnMount = false,
  atualizarLabel = "Atualizar Ronda",
  tituloEhLink = false,
  showHeaderDescription = true,
  showMainNavRow = false,
  mainNavSecondIsAdmin = false,
}: RondaClientProps) {
  const [noticias, setNoticias] = useState<NoticiaRonda[]>([]);
  const [jaBuscou, setJaBuscou] = useState(false);
  const [carregandoLista, setCarregandoLista] = useState(autoLoadOnMount);
  const [erro, setErro] = useState<string | null>(null);
  const autoLoadFeito = useRef(false);

  const atualizarRonda = useCallback(async (forceRefresh?: boolean) => {
    setErro(null);
    setCarregandoLista(true);
    try {
      const q = forceRefresh ? "?refresh=1" : "";
      const res = await fetch(`${apiPath}${q}`);
      const raw = await res.text();
      let body: {
        ok?: boolean;
        error?: string;
        noticias?: NoticiaRonda[];
      };
      try {
        body = JSON.parse(raw) as typeof body;
      } catch {
        const snippet = raw.replace(/\s+/g, " ").slice(0, 120);
        throw new Error(
          res.ok
            ? `Resposta da API não é JSON (${snippet || "vazio"}).`
            : `Erro ${res.status}: ${snippet || "sem corpo"}.`
        );
      }
      if (!res.ok || body.ok === false) {
        throw new Error(body.error ?? "Não foi possível carregar a ronda.");
      }
      setNoticias(body.noticias ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setNoticias([]);
    } finally {
      setCarregandoLista(false);
      setJaBuscou(true);
    }
  }, [apiPath]);

  useEffect(() => {
    if (!autoLoadOnMount || autoLoadFeito.current) return;
    autoLoadFeito.current = true;
    void atualizarRonda();
  }, [autoLoadOnMount, atualizarRonda]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/90">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-teal-700">Editorial</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {pageTitle}
            </h1>
            {showHeaderDescription ? (
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Exibindo as 10 notícias mais recentes de cada fonte oficial,
                ordenadas pela data de publicação no site (quando disponível).
                Itens sem data na listagem vão ao fim, pela ordem da captura.
                Pente-fino manual, sem IA.
              </p>
            ) : null}
          </div>
          {showMainNavRow ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
              >
                Calendário
              </Link>
              <Link
                href={mainNavSecondIsAdmin ? "/admin" : "/ronda-rss"}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
              >
                {mainNavSecondIsAdmin ? "Admin" : "Radar de Pautas"}
              </Link>
              <Link
                href="/escala"
                className="inline-flex items-center justify-center rounded-md border border-slate-400 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
              >
                Escala
              </Link>
              <Link
                href="/nova-pauta"
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Nova Pauta
              </Link>
            </div>
          ) : (
            <Link
              href="/"
              className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              ← Painel de pautas
            </Link>
          )}
        </header>

        <div className="mb-8">
          <button
            type="button"
            disabled={carregandoLista}
            onClick={() => void atualizarRonda(true)}
            className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {carregandoLista ? "Carregando..." : atualizarLabel}
          </button>
        </div>

        {erro && (
          <div
            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {erro}
          </div>
        )}

        {jaBuscou && !carregandoLista && noticias.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-12 text-center text-sm text-slate-500">
            Nenhuma notícia retornada pelos feeds. Clique em{" "}
            <strong>{atualizarLabel}</strong> para tentar de novo.
          </p>
        )}

        {noticias.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {noticias.map((n, i) => (
              <article
                key={`ronda-${i}-${n.link}`}
                className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h2
                  className={
                    tituloEhLink
                      ? "text-sm font-semibold leading-snug text-slate-900"
                      : "line-clamp-3 text-sm font-semibold leading-snug text-slate-900"
                  }
                >
                  {tituloEhLink ? (
                    <a
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="line-clamp-3 block text-inherit transition hover:text-teal-700 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                    >
                      {n.titulo}
                    </a>
                  ) : (
                    n.titulo
                  )}
                </h2>
                <div className="mt-2 flex items-center gap-2">
                  <FonteLogo fonte={n.fonte} />
                  <p className="text-xs font-medium text-teal-800">{n.fonte}</p>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {formatPublicadoNoSite(n.publicado_em)}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Na lista: {formatRelativePast(n.data_publicacao)}
                </p>
                {!tituloEhLink && (
                  <div className="mt-3">
                    <a
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                    >
                      Ler Matéria
                    </a>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
