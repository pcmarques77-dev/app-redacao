"use server";

import { revalidatePath } from "next/cache";
import { getAdminActor } from "@/app/actions/admin";
import { atualizarUltimasViva } from "@/lib/viva-ultimas";

/** Coleta o Viva e grava o snapshot. A página em si só lê o que já foi salvo. */
export async function atualizarUltimasAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const actor = await getAdminActor();
  if (!actor.ok) return { ok: false, error: actor.error };

  const res = await atualizarUltimasViva();
  if (!res.ok) return res;

  revalidatePath("/ultimas");
  return { ok: true };
}
