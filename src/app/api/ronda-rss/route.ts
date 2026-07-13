import { agregarRondaRss, type RondaRssKind } from "@/lib/ronda-rss-agregado";
import { NextResponse, type NextRequest } from "next/server";

export const maxDuration = 120;

const JSON_NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
} as const;

function kindFromRequest(request: NextRequest): RondaRssKind {
  return request.nextUrl.searchParams.get("kind") === "tech" ? "tech" : "gov";
}

/** Agrega feeds RSS ao vivo a cada requisição (reload, aba ou botão Atualizar). */
export async function GET(request: NextRequest) {
  const kind = kindFromRequest(request);

  try {
    const data = await agregarRondaRss(kind);
    return NextResponse.json(data, { headers: JSON_NO_STORE });
  } catch (e) {
    console.error("[ronda-rss]", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao montar o Radar de Pautas." },
      { status: 500, headers: JSON_NO_STORE }
    );
  }
}
