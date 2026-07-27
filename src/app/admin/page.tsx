import { Suspense } from "react";
import { AdminUsuariosPageContent } from "@/app/admin/AdminUsuariosPageContent";
import { loadPautasHeaderSession } from "@/components/PautasAppHeaderServer";

export default async function AdminUsuariosPage() {
  const headerSession = await loadPautasHeaderSession();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100/80 text-sm text-slate-600">
          Carregando…
        </div>
      }
    >
      <AdminUsuariosPageContent headerSession={headerSession} />
    </Suspense>
  );
}
