import { agregarRondaRss } from "@/lib/ronda-rss-agregado";
import { unstable_cache } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

export const maxDuration = 120;

const getRondaRssCached = unstable_cache(agregarRondaRss, ["ronda-rss-v1"], {
  revalidate: 90,
});

const JSON_NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
} as const;

export async function GET(request: NextRequest) {
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  try {
    const data = refresh ? await agregarRondaRss() : await getRondaRssCached();
    return NextResponse.json(data, { headers: JSON_NO_STORE });
  } catch (e) {
    console.error("[ronda-rss]", e);
    return NextResponse.json(
      { ok: false, error: "Falha ao montar o Radar de Pautas." },
      { status: 500, headers: JSON_NO_STORE }
    );
  }
}
