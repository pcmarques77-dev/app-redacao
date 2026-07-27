import { redirect } from "next/navigation";
import { getSessionPrivilegesAction } from "@/app/actions/admin";
import { EscalaWeekendPlanner } from "@/components/EscalaWeekendPlanner";
import { PautasAppHeader } from "@/components/PautasAppHeader";
import { loadPautasHeaderSession } from "@/components/PautasAppHeaderServer";

export default async function EscalaPlantoesPage() {
  const res = await getSessionPrivilegesAction();
  if (!res.ok || !res.session.canManageEscala) {
    redirect("/");
  }

  const headerSession = await loadPautasHeaderSession();

  return (
    <div className="mx-auto min-h-screen max-w-page bg-white px-4 py-10 sm:px-6 lg:px-8">
      <PautasAppHeader session={headerSession} />
      <div className="mt-6">
        <EscalaWeekendPlanner />
      </div>
    </div>
  );
}
