"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { atualizarUltimasAction } from "@/app/actions/ultimas";

export function UltimasAtualizar() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function atualizar() {
    setPending(true);
    setErro(null);
    const res = await atualizarUltimasAction();
    setPending(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => void atualizar()}
        disabled={pending}
        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Atualizando…" : "Atualizar"}
      </button>
      {erro ? (
        <p className="text-sm text-red-700" role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
