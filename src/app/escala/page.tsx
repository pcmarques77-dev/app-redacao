"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSessionPrivilegesAction } from "@/app/actions/admin";
import { EscalaForm } from "@/components/EscalaForm";

export default function EscalaPage() {
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
      <div className="mx-auto max-w-page px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-600" role="status">
          Verificando permissão…
        </p>
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return (
    <div className="mx-auto max-w-page px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Voltar às pautas
          </Link>
          <Link
            href="/escala/plantoes"
            className="text-blue-600 hover:text-blue-800"
          >
            Plantões (fins de semana)
          </Link>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
          Escala
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Cadastre feriado, plantão ou férias para aparecer no calendário.
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <EscalaForm
          variant="page"
          onSuccess={() => router.push("/")}
        />
      </div>
    </div>
  );
}
