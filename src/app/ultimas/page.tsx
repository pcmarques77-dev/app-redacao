import { UltimasAtualizar } from "@/components/UltimasAtualizar";
import { UltimasIndex } from "@/components/UltimasIndex";
import { PautasAppHeader } from "@/components/PautasAppHeader";
import { loadPautasHeaderSession } from "@/components/PautasAppHeaderServer";
import { readUltimasSnapshot } from "@/lib/ultimas-snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata = {
  title: "Últimas",
};

export default async function UltimasPage() {
  const [headerSession, snap] = await Promise.all([
    loadPautasHeaderSession(),
    readUltimasSnapshot(),
  ]);

  return (
    <main className="min-h-screen bg-slate-100/80">
      <div className="mx-auto max-w-page px-4 py-10 sm:px-6 lg:px-8">
        <PautasAppHeader session={headerSession} />
        <div className="mt-6 max-w-5xl">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Últimas
          </h1>
          <UltimasAtualizar />
          <div className="mt-5">
            {snap ? (
              <UltimasIndex
                itens={snap.itens}
                editorias={snap.editorias}
                atualizadoEm={snap.atualizadoEm}
                avisos={snap.avisos}
              />
            ) : (
              <p
                className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-600 shadow-sm"
                role="status"
              >
                Ainda não há uma coleta salva. Use Atualizar para ler as
                reportagens publicadas no Viva.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
