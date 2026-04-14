"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

const PUBLIC_AUTH_PATHS = new Set([
  "/login",
  "/esqueci-senha",
  "/atualizar-senha",
]);

export function SignOutButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/sign-out", { method: "POST" });
      if (!res.ok) {
        const supabase = createBrowserClient();
        await supabase.auth.signOut();
      }
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }, [router]);

  if (!pathname || PUBLIC_AUTH_PATHS.has(pathname)) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={loggingOut}
      title="Encerrar sessão"
      className="fixed bottom-6 right-6 z-30 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loggingOut ? "Saindo…" : "Sair"}
    </button>
  );
}
