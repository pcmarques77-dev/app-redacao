"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getSessionPrivilegesAction } from "@/app/actions/admin";
import { EscalaWeekendPlanner } from "@/components/EscalaWeekendPlanner";
import { PautasAppHeader } from "@/components/PautasAppHeader";

function PlantoesPageShell({ children }: { children?: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-page bg-white px-4 py-10 sm:px-6 lg:px-8">
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
    void (async () => {
      try {
        const res = await getSessionPrivilegesAction();
        if (!res.ok || !res.session.canManageEscala) {
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
