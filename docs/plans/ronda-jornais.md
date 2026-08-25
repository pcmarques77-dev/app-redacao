# Plano: Ronda Jornais (grandes veículos)

Status: **implementado** (2026-07-22).

## Objetivo do produto

Nova aba **Ronda Jornais** no Radar de Pautas (`/ronda-rss`): concentrar **manchetes / últimas** dos grandes veículos de imprensa, **sem** filtro temático.

| Aba | Papel |
|-----|--------|
| Ronda INSS / Longevidade | Tema via Google News |
| **Ronda Jornais** | Grandes veículos, últimas notícias |

## Abordagem técnica recomendada

**Híbrido: RSS na frente; scraping só onde o RSS falha ou é inútil.**

1. RSS estável: CNN (`https://admin.cnnbrasil.com.br/feed/`), Metrópoles, G1, O Globo, Terra, seções Estadão que respondem bem, etc.
2. Scraping (Cheerio, padrão de `feeds-governo.ts` / Radar Old) só para sites sem RSS útil ou instável (ex.: Folha/UOL/alguns Estadão).
3. Snapshot Supabase (`ronda_rss_snapshot`, **id=5** já existe no projeto remoto com payload vazio — reutilizar) + push via **crontab horário no servidor** (mesmo fluxo das outras rondas; GitHub Actions só como contingência — ver [`docs/radar-snapshots.md`](../radar-snapshots.md)).

Evitar scraping de *todos* os sites como estratégia principal (HTML frágil, WAF, custo operacional).

## Fontes candidatas (lista original, deduplicada)

| Fonte | URL / nota |
|-------|------------|
| Estadão — Saúde | `.../arc/outboundfeeds/feeds/rss/sections/saude/` |
| Estadão — Política / Economia / Brasil / Pulsa / Ciência | mesmos padrões `/sections/.../` |
| Folha — Equilíbrio e Saúde | preferir RSS `feeds.folha.uol.com.br/equilibrioesaude/rss091.xml` (página HTML não é feed) |
| Folha — Em cima da hora | `feeds.folha.uol.com.br/emcimadahora/rss091.xml` |
| G1 | `https://g1.globo.com/rss/g1/` |
| O Globo | `https://pox.globo.com/rss/oglobo/` |
| UOL Notícias | `rss.uol.com.br/feed/noticias.xml` — validar; parser atual pode rejeitar |
| Metrópoles | `https://www.metropoles.com/feed` |
| Terra | `https://www.terra.com.br/rss` |
| CNN Brasil | `https://admin.cnnbrasil.com.br/feed/` |
| ~~CNN sitemap~~ | `sitemap-news.xml` — **não usar** (não é RSS) |

## O que NÃO fazer

- Filtro por keywords (`aposentadoria`, `INSS`, `longevidade`, …) nesta aba.
- Depender só de fetch ao vivo na Vercel para feeds que timeout/WAF (usar snapshot).

## Passos de implementação (quando retomar)

1. Extender `RondaRssKind` com `"jornais"` em [`src/lib/ronda-rss-agregado.ts`](../src/lib/ronda-rss-agregado.ts); lista de feeds **sem** keywords.
2. Snapshot: `jornais: 5` em [`src/lib/ronda-rss-snapshot.ts`](../src/lib/ronda-rss-snapshot.ts); incluir no push em [`src/lib/ronda-rss-push-snapshot-core.ts`](../src/lib/ronda-rss-push-snapshot-core.ts).  
   - Constraint `id in (1..5)` **já aplicada** no Supabase remoto; se o repo ainda não tiver migration, criar migration no-op/documental ou só usar o id.
3. API [`src/app/api/ronda-rss/route.ts`](../src/app/api/ronda-rss/route.ts): `kind=jornais` + caches.
4. UI [`src/app/ronda-rss/page.tsx`](../src/app/ronda-rss/page.tsx): aba “Ronda Jornais”.
5. Logos em [`src/lib/fonte-logos.ts`](../src/lib/fonte-logos.ts).
6. Para fontes sem RSS: scrapers dedicados + job no servidor (crontab horário).
7. Validar push de snapshot (`npm run ronda:push-snapshot`) e a aba com duas sessões / refresh.

## Lições do protótipo (2026-07-22, descartado)

Protótipo com RSS + filtro por keywords foi feito e **removido** do código porque:

- Duplicava o propósito das abas INSS/Longevidade.
- Feeds generalistas têm poucos hits temáticos no topo.
- Vários feeds (Estadão/Folha) falhavam por timeout nesta rede; UOL não parseava como RSS 1/2.
- Snippets longos (O Globo) geravam falso positivo via rodapé de matérias relacionadas.

## Nota sobre o banco

No projeto Supabase “Calendário de Pautas”, a linha `ronda_rss_snapshot` **id=5** já foi criada (payload vazio). Pode ser reaproveitada na implementação definitiva.
