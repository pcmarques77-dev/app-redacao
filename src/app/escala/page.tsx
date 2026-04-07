"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EscalaForm } from "@/components/EscalaForm";

export default function EscalaPage() {
  const router = useRouter();

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
