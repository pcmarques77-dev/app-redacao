import { RondaClient } from "@/app/ronda/RondaClient";
import { loadPautasHeaderSession } from "@/components/PautasAppHeaderServer";

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

export default async function RondaRssPage() {
  const headerSession = await loadPautasHeaderSession();

  const roundTabs = [
    {
      id: "gov",
      label: "Ronda Gov",
      apiPath: "/api/ronda-rss?kind=gov",
    },
    {
      id: "jornais",
      label: "Ronda Jornais",
      apiPath: "/api/ronda-rss?kind=jornais",
    },
    {
      id: "trends-seo",
      label: "Google Trends",
      apiPath: "/api/trends-seo",
      emptyLabel: "Nenhum assunto em alta retornado pelo Google Trends.",
      enableDateVolumeSort: true,
    },
    {
      id: "inss",
      label: "Ronda INSS",
      apiPath: "/api/ronda-rss?kind=inss",
    },
    {
      id: "longevidade",
      label: "Ronda Longevidade",
      apiPath: "/api/ronda-rss?kind=longevidade",
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
      headerSession={headerSession}
    />
  );
}
