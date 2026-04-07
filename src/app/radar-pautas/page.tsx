import { RondaClient } from "@/app/ronda/RondaClient";

export const metadata = {
  title: "Radar Old",
};

export default function RadarPautasPage() {
  return (
    <RondaClient
      pageTitle="Radar Old"
      autoLoadOnMount
      atualizarLabel="Atualizar Radar Old"
      tituloEhLink
    />
  );
}
