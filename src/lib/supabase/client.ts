import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Cliente browser com sessão em cookies (compatível com middleware e Server Components). */
export function createBrowserClient() {
  return createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);
}

type BrowserSupabaseClient = ReturnType<typeof createSupabaseBrowserClient>;

/**
 * Garante JWT no cliente antes de queries sujeitas a RLS (ex.: políticas para `authenticated`).
 * Sem isto, o primeiro pedido pode ir como `anon` e devolver 0 linhas sem erro.
 */
export async function ensureSupabaseAuthReady(
  client: BrowserSupabaseClient
): Promise<void> {
  await client.auth.getUser();
}
