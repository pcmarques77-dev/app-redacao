import { pushRondaRssSnapshots } from "@/lib/ronda-rss-push-snapshot-core";
import { NextResponse, type NextRequest } from "next/server";

export const maxDuration = 120;

function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

/** Atualiza snapshots em `ronda_rss_snapshot` (Vercel Cron ou chamada manual). */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401 }
    );
  }

  const result = await pushRondaRssSnapshots();
  if (!result.ok) {
    console.error("[cron/ronda-rss-snapshot]", result.error, result.kind ?? "");
    return NextResponse.json(
      { ok: false, error: result.error, kind: result.kind ?? null },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    totals: result.totals,
    updatedAt: new Date().toISOString(),
  });
}
