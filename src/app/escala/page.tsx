"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EscalaForm } from "@/components/EscalaForm";
import { canManageEscala } from "@/lib/admin-acl";
import { createBrowserClient } from "@/lib/supabase/client";

export default function EscalaPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();
    void (async () => {
      try {
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
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 lg:px-8">
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
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <Link
          href="/"
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          ← Voltar às pautas
        </Link>
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
