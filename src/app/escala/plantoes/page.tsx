"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { EscalaWeekendPlanner } from "@/components/EscalaWeekendPlanner";
import { PautasAppHeader } from "@/components/PautasAppHeader";
import { canManageEscala } from "@/lib/admin-acl";
import {
  createBrowserClient,
  ensureSupabaseAuthReady,
} from "@/lib/supabase/client";

function PlantoesPageShell({ children }: { children?: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-6xl bg-white px-4 py-10 sm:px-6 lg:px-8">
      <PautasAppHeader />
      <div className="mt-6">{children}</div>
    </div>
  );
}

export default function EscalaPlantoesPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();
    void (async () => {
      try {
        await ensureSupabaseAuthReady(supabase);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) {
          router.replace("/");
          return;
        }
        const { data: row } = await supabase
          .from("usuarios")
          .select("funcao")
          .eq("id", user.id)
          .maybeSingle();
        if (
          !canManageEscala({
            email: user.email,
            funcao: row?.funcao ?? null,
          })
        ) {
          router.replace("/");
          return;
        }
        setAllowed(true);
      } catch {
        router.replace("/");
      } finally {
        setChecking(false);
      }
    })();
  }, [router]);

  if (checking) {
    return (
      <PlantoesPageShell>
        <p className="text-sm text-slate-600" role="status">
          Verificando permissão…
        </p>
      </PlantoesPageShell>
    );
  }

  if (!allowed) {
    return null;
  }

  return (
    <PlantoesPageShell>
      <EscalaWeekendPlanner />
    </PlantoesPageShell>
  );
}
