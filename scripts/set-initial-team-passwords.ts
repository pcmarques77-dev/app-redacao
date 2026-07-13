/**
 * Define a mesma senha inicial para a equipe no Supabase Auth (exceto admin e contas de teste).
 *
 * Uso (nunca commite a senha no repositório):
 *
 *   # 1) Simular — lista quem seria alterado
 *   $env:INITIAL_TEAM_PASSWORD="SuaSenhaInicial2026"
 *   npm run auth:set-initial-passwords
 *
 *   # 2) Aplicar de verdade
 *   $env:INITIAL_TEAM_PASSWORD="SuaSenhaInicial2026"
 *   npm run auth:set-initial-passwords -- --apply
 *
 * Requer no ambiente: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 * (ex.: do .env.local, exportados no PowerShell antes do comando).
 */
import { createClient } from "@supabase/supabase-js";
import { isExcludedFromBatchPasswordReset } from "../src/lib/usuarios-select";

function cleanEnvValue(raw: string | undefined): string {
  if (raw == null) return "";
  let s = raw.replace(/\r\n/g, "\n").replace(/\r/g, "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

type UsuarioRow = {
  id: string;
  nome: string | null;
  email: string | null;
};

async function main() {
  const apply = process.argv.includes("--apply");
  const url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const password = cleanEnvValue(process.env.INITIAL_TEAM_PASSWORD);

  if (!url || !key) {
    console.error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ex.: do .env.local)."
    );
    process.exit(1);
  }
  if (!password) {
    console.error(
      "Defina INITIAL_TEAM_PASSWORD com a senha inicial (mín. 6 caracteres)."
    );
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("INITIAL_TEAM_PASSWORD deve ter pelo menos 6 caracteres.");
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: rows, error } = await admin
    .from("usuarios")
    .select("id, nome, email")
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao listar usuarios:", error.message);
    process.exit(1);
  }

  const all = (rows ?? []) as UsuarioRow[];
  const skipped = all.filter((u) =>
    isExcludedFromBatchPasswordReset({ email: u.email, nome: u.nome })
  );
  const targets = all.filter(
    (u) => !isExcludedFromBatchPasswordReset({ email: u.email, nome: u.nome })
  );

  console.log(
    apply
      ? "[auth:set-initial-passwords] Aplicando senha inicial…"
      : "[auth:set-initial-passwords] Modo simulação (adicione --apply para executar)."
  );
  console.log(`Total em usuarios: ${all.length}`);
  console.log(`Ignorados (admin/teste): ${skipped.length}`);
  for (const u of skipped) {
    console.log(`  - ${u.nome?.trim() || "—"} <${u.email?.trim() || "sem e-mail"}>`);
  }
  console.log(`Alvo: ${targets.length}`);

  let ok = 0;
  let fail = 0;

  for (const u of targets) {
    const label = `${u.nome?.trim() || "—"} <${u.email?.trim() || "sem e-mail"}>`;
    if (!u.email?.trim()) {
      console.warn(`  ! Sem e-mail — pulando: ${label}`);
      fail += 1;
      continue;
    }

    if (!apply) {
      console.log(`  → ${label}`);
      ok += 1;
      continue;
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(u.id, {
      password,
    });

    if (updErr) {
      console.error(`  ✗ ${label}: ${updErr.message}`);
      fail += 1;
      continue;
    }

    console.log(`  ✓ ${label}`);
    ok += 1;
  }

  console.log(
    apply
      ? `Concluído: ${ok} atualizado(s), ${fail} falha(s).`
      : `Simulação: ${ok} seriam atualizado(s), ${fail} com problema(s). Rode com --apply para aplicar.`
  );

  if (fail > 0) process.exit(1);
}

void main();
