import { atualizarUltimasViva } from "@/lib/viva-ultimas";
import { NextResponse, type NextRequest } from "next/server";

export const maxDuration = 60;

function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

/** Atualiza `ultimas_viva_snapshot` (cron ou chamada manual com CRON_SECRET). */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401 }
    );
  }

  const result = await atualizarUltimasViva();
  if (!result.ok) {
    console.error("[cron/ultimas-snapshot]", result.error);
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    total: result.itens.length,
    updatedAt: result.atualizadoEm,
  });
}
