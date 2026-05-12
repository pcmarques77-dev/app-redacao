import { RondaClient } from "@/app/ronda/RondaClient";

export const metadata = {
  title: "Radar de Pautas",
};

const discoverEmbedUrl =
  process.env.NEXT_PUBLIC_DISCOVER_MONITORING_URL?.trim() || null;

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
      showMainNavRow
      mainNavSecondIsAdmin
    />
  );
}
