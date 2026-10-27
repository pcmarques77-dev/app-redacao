import { Suspense } from "react";
import { UltimasIndex } from "@/components/UltimasIndex";
import { PautasAppHeader } from "@/components/PautasAppHeader";
import { loadPautasHeaderSession } from "@/components/PautasAppHeaderServer";
import { listarUltimasViva } from "@/lib/viva-ultimas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata = {
  title: "Últimas",
};

function UltimasCarregando() {
  return (
    <p className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-600 shadow-sm" role="status">
      Lendo as reportagens publicadas no Viva…
    </p>
  );
}

async function UltimasConteudo() {
  const res = await listarUltimasViva();
  if (!res.ok) {
    return (
      <p
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        role="alert"
      >
        {res.error}
      </p>
    );
  }

  return (
    <UltimasIndex
      itens={res.itens}
      editorias={res.editorias}
      atualizadoEm={res.atualizadoEm}
      avisos={res.avisos}
    />
  );
}

export default async function UltimasPage() {
  const headerSession = await loadPautasHeaderSession();

  return (
    <main className="min-h-screen bg-slate-100/80">
      <div className="mx-auto max-w-page px-4 py-10 sm:px-6 lg:px-8">
        <PautasAppHeader session={headerSession} />
        <div className="mt-6 max-w-5xl">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Últimas
          </h1>
          <div className="mt-5">
            <Suspense fallback={<UltimasCarregando />}>
              <UltimasConteudo />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
