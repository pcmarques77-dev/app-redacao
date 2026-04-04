import { redirect } from "next/navigation";

/** Rota antiga do radar com IA; mantida só para links salvos. */
export default function RadarLegacyRedirect() {
  redirect("/radar-pautas");
}
