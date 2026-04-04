import { RondaClient } from "@/app/ronda/RondaClient";

export const metadata = {
  title: "Radar de Pautas",
};

export default function RadarPautasPage() {
  return (
    <RondaClient
      pageTitle="Radar de Pautas"
      autoLoadOnMount
      atualizarLabel="Atualizar pautas"
      tituloEhLink
    />
  );
}
