/** Rota do calendário geral de pautas (home autenticada). */
export const CALENDARIO_PAUTAS_PATH = "/";

/** sessionStorage — estado do calendário/lista no painel (`PautasDashboard`). */
export const DASHBOARD_CAL_STORAGE_KEY = "pautas-dashboard-cal-v1";

/** Disparado ao clicar no logo estando já em `/` — força vista Calendário. */
export const PAUTAS_DASHBOARD_HOME_EVENT = "pautas-dashboard-home";

export function clearDashboardCalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(DASHBOARD_CAL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function dispatchDashboardHomeEvent(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PAUTAS_DASHBOARD_HOME_EVENT));
}
