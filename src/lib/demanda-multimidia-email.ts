import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resendFromAddress(): string {
  if (process.env.NODE_ENV === "development") {
    return "onboarding@resend.dev";
  }
  return process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";
}

/**
 * Envia e-mail aos usuários com `funcao` ENUM igual a `Editor` quando há demanda multimídia.
 * Falhas são apenas logadas; não interrompem o fluxo da pauta.
 */
export async function notifyEditorsDemandaMultimidia(
  admin: SupabaseClient,
  args: { titulo: string; reporterNome: string; resumo: string | null }
): Promise<void> {
  const { data: editors, error } = await admin
    .from("usuarios")
    .select("email")
    .eq("funcao", "Editor");

  if (error) {
    console.error("[demanda-multimidia] listar editores:", error.message);
    return;
  }

  const listaEmails = (editors ?? [])
    .map((r: { email?: string | null }) =>
      typeof r.email === "string" ? r.email.trim() : ""
    )
    .filter((e: string) => e.length > 0);

  console.log("Editores encontrados:", listaEmails);

  if (listaEmails.length === 0) {
    console.warn("[demanda-multimidia] nenhum e-mail de Editor encontrado.");
    return;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("[demanda-multimidia] defina RESEND_API_KEY no servidor.");
    return;
  }

  const from = resendFromAddress();
  const resend = new Resend(apiKey);
  const subject = `🚩 Nova Demanda Multimídia: ${args.titulo}`;
  const resumoText = args.resumo?.trim() || "—";
  const html = `
    <p><strong>Título</strong><br>${escapeHtml(args.titulo)}</p>
    <p><strong>Repórter responsável</strong><br>${escapeHtml(args.reporterNome)}</p>
    <p><strong>Resumo</strong><br>${escapeHtml(resumoText).replace(/\n/g, "<br>")}</p>
  `;

  for (const recipient of listaEmails) {
    try {
      const { error: sendErr } = await resend.emails.send({
        from,
        to: recipient,
        subject,
        html,
      });
      if (sendErr) {
        console.error(
          `[demanda-multimidia] Resend erro (${recipient}):`,
          sendErr.message,
          JSON.stringify(sendErr, null, 2)
        );
      }
    } catch (e) {
      console.error(`[demanda-multimidia] Resend exceção (${recipient}):`, e);
    }
  }
}
