import { PautasDashboard } from "@/components/PautasDashboard";
import { loadPautasHeaderSession } from "@/components/PautasAppHeaderServer";

export default async function Home() {
  const headerSession = await loadPautasHeaderSession();
  return (
    <main className="min-h-screen bg-slate-100/80">
      <PautasDashboard headerSession={headerSession} />
    </main>
  );
}
