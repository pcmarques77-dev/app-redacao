"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getSessionPrivilegesAction } from "@/app/actions/admin";
import logoVivaTaglineAzul from "@/assets/logo-viva-tagline-azul.svg";
import {
  CALENDARIO_PAUTAS_PATH,
  clearDashboardCalStorage,
  dispatchDashboardHomeEvent,
} from "@/lib/dashboard-home";

/**
 * Cabeçalho do calendário geral (logo, cadastro, Calendário, Radar de Pautas, Produção*, Plantões*, Admin, Nova Pauta).
 * *Produção e Plantões só para Editor/super admin.
 * Privilégios via server action (ignora RLS no `funcao` do cliente).
 * Reutilizado em `/` e em páginas como `/escala/plantoes`.
 */
export function PautasAppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionCtx, setSessionCtx] = useState<{
    userId: string;
    email: string;
    nome: string | null;
    canManageEscala: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await getSessionPrivilegesAction();
      if (cancelled) return;
      if (!res.ok) {
        setSessionCtx(null);
        return;
      }
      setSessionCtx({
        userId: res.session.userId,
        email: res.session.email,
        nome: res.session.nome,
        canManageEscala: res.session.canManageEscala,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logoVivaTaglineSrc =
    typeof logoVivaTaglineAzul === "string"
      ? logoVivaTaglineAzul
      : logoVivaTaglineAzul.src;

  const onCalendario = pathname === CALENDARIO_PAUTAS_PATH;
  const onRadar = pathname.startsWith("/ronda-rss");
  const onPlantoes = pathname.startsWith("/escala/plantoes");
  const onProducao = pathname.startsWith("/producao");
  const onAdmin = pathname.startsWith("/admin");
  const onNovaPauta = pathname.startsWith("/nova-pauta");

  const handleCalendarioHomeClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (pathname !== CALENDARIO_PAUTAS_PATH) return;
      e.preventDefault();
      clearDashboardCalStorage();
      dispatchDashboardHomeEvent();
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    },
    [pathname, router]
  );

  const outlineNavBase =
    "inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
  const outlineNavInactive = `${outlineNavBase} border border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-slate-400`;
  const outlineNavActive = `${outlineNavBase} border-2 border-blue-600 bg-blue-50 font-semibold text-blue-900 ring-2 ring-blue-600/20 hover:bg-blue-100/90 focus-visible:outline-blue-600`;

  return (
    <header className="mb-0 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="m-0">
          <Link
            href={CALENDARIO_PAUTAS_PATH}
            onClick={handleCalendarioHomeClick}
            aria-label="Ir para o Calendário de pautas"
            className="inline-block max-w-full cursor-pointer rounded-sm text-left transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG vetorial importado de assets */}
            <img
              src={logoVivaTaglineSrc}
              alt=""
              width={7418}
              height={1175}
              className="h-8 w-auto max-h-9 max-w-[min(100%,18rem)] object-contain object-left sm:h-10 sm:max-h-11 sm:max-w-[min(100%,22rem)] lg:max-w-[26rem]"
            />
          </Link>
        </h1>
        {sessionCtx ? (
          <p className="mt-2 text-sm">
            <Link
              href={`/admin?editar=${encodeURIComponent(sessionCtx.userId)}`}
              className="font-medium text-blue-700 underline-offset-2 hover:text-blue-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {(sessionCtx.nome ?? "").trim() ||
                sessionCtx.email ||
                "Meu cadastro"}
            </Link>
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
        <Link
          href={CALENDARIO_PAUTAS_PATH}
          onClick={handleCalendarioHomeClick}
          className={onCalendario ? outlineNavActive : outlineNavInactive}
          aria-current={onCalendario ? "page" : undefined}
        >
          Calendário
        </Link>
        <Link
          href="/ronda-rss"
          className={onRadar ? outlineNavActive : outlineNavInactive}
          aria-current={onRadar ? "page" : undefined}
        >
          Radar de Pautas
        </Link>
        {sessionCtx?.canManageEscala ? (
          <>
            <Link
              href="/producao"
              className={onProducao ? outlineNavActive : outlineNavInactive}
              aria-current={onProducao ? "page" : undefined}
            >
              Produção
            </Link>
            <Link
              href="/escala/plantoes"
              className={onPlantoes ? outlineNavActive : outlineNavInactive}
              aria-current={onPlantoes ? "page" : undefined}
            >
              Plantões
            </Link>
          </>
        ) : null}
        <Link
          href="/admin"
          className={onAdmin ? outlineNavActive : outlineNavInactive}
          aria-current={onAdmin ? "page" : undefined}
        >
          Admin
        </Link>
        <Link
          href="/nova-pauta"
          className={
            onNovaPauta
              ? "inline-flex items-center justify-center rounded-md border-2 border-blue-800 bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm ring-2 ring-blue-400/60 ring-offset-2 ring-offset-white transition-colors hover:bg-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              : "inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          }
          aria-current={onNovaPauta ? "page" : undefined}
        >
          Nova Pauta
        </Link>
      </div>
    </header>
  );
}
