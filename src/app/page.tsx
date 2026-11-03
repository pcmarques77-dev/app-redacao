import { loadDashboardAction } from "@/app/actions/dashboard";
import { PautasDashboard } from "@/components/PautasDashboard";
import { loadPautasHeaderSession } from "@/components/PautasAppHeaderServer";
import { defaultDashboardQueryInput } from "@/lib/escala-query-range";

export default async function Home() {
  const query = defaultDashboardQueryInput();
  const [headerSession, dash] = await Promise.all([
    loadPautasHeaderSession(),
    loadDashboardAction(query),
  ]);

  return (
    <main className="min-h-screen bg-slate-100/80">
      <PautasDashboard
        headerSession={headerSession}
        initialDashboard={
          dash.ok
            ? {
                session: dash.session,
                pautas: dash.pautas,
                escalas: dash.escalas,
                reporters: dash.reporters,
                query,
              }
            : null
        }
      />
    </main>
  );
}
