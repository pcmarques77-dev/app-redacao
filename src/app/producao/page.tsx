import { redirect } from "next/navigation";
import { getSessionPrivilegesAction } from "@/app/actions/admin";
import { HardNewsQueue } from "@/components/HardNewsQueue";
import { PautasAppHeader } from "@/components/PautasAppHeader";
import { loadPautasHeaderSession } from "@/components/PautasAppHeaderServer";

export default async function ProducaoPage() {
  const res = await getSessionPrivilegesAction();
  if (!res.ok || !res.session.canManageEscala) {
    redirect("/");
  }

  const headerSession = await loadPautasHeaderSession();

  return (
    <div className="mx-auto min-h-screen max-w-page bg-white px-4 py-10 sm:px-6 lg:px-8">
      <PautasAppHeader session={headerSession} />
      <div className="mt-6">
        <HardNewsQueue />
      </div>
    </div>
  );
}
