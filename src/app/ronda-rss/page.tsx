import { RondaClient } from "@/app/ronda/RondaClient";

export const metadata = {
  title: "Radar de Pautas",
};

export default function RondaRssPage() {
  return (
    <RondaClient
      pageTitle="Radar de Pautas"
      apiPath="/api/ronda-rss"
      autoLoadOnMount
      atualizarLabel="Atualizar Radar de Pautas"
      tituloEhLink
    />
  );
}
