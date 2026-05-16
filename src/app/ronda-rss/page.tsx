import { RondaClient } from "@/app/ronda/RondaClient";

/** Evita pré-render estático com URL vazia: lê env no deploy a cada request. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Radar de Pautas",
};

/** Preferir `DISCOVER_MONITORING_EMBED_URL` no painel do host (só servidor); fallback para dev local. */
const discoverEmbedUrl =
  process.env.DISCOVER_MONITORING_EMBED_URL?.trim() ||
  process.env.NEXT_PUBLIC_DISCOVER_MONITORING_URL?.trim() ||
  null;

export default function RondaRssPage() {
  const roundTabs = [
    {
      id: "gov",
      label: "Ronda Gov",
      apiPath: "/api/ronda-rss?kind=gov",
    },
    {
      id: "tech",
      label: "Ronda Tech",
      apiPath: "/api/ronda-rss?kind=tech",
    },
    ...(discoverEmbedUrl
      ? ([
          {
            id: "discover",
            label: "Discover",
            embedUrl: discoverEmbedUrl,
          },
        ] as const)
      : []),
  ];

  return (
    <RondaClient
      pageTitle="Radar de Pautas"
      roundTabs={roundTabs}
      autoLoadOnMount
      atualizarLabel="Atualizar Radar de Pautas"
      tituloEhLink
      showHeaderDescription={false}
      showPautasAppHeader
    />
  );
}
