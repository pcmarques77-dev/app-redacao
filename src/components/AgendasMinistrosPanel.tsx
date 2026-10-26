"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadAgendasMinistrosAction,
  type AgendasMinistrosModo,
} from "@/app/actions/agendas-ministros";
import { formatDeadlinePtBR } from "@/lib/deadline-date";
import type { AgendaMinistroCard } from "@/lib/eagendas";

/** Precisa coincidir com a janela em loadAgendasMinistrosAction. */
const RADAR_AGENDAS_DAYS = 21;

function formatDiaCard(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return formatDeadlinePtBR(ymd);
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const raw = date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  const label = raw.replace(/\./g, "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function horaTexto(agenda: AgendaMinistroCard): string {
  const parts = [agenda.horaInicio, agenda.horaFim].filter((part) =>
    Boolean(part?.trim())
  );
  return parts.length > 0 ? parts.join("–") : "Horário não informado";
}

function dataTexto(agenda: AgendaMinistroCard): string {
  if (agenda.dataFim && agenda.dataFim !== agenda.dataInicio) {
    return `${formatDeadlinePtBR(agenda.dataInicio)} – ${formatDeadlinePtBR(agenda.dataFim)}`;
  }
  return formatDeadlinePtBR(agenda.dataInicio);
}

function AgendaMinistroCardItem({ agenda }: { agenda: AgendaMinistroCard }) {
  const multiDia = Boolean(
    agenda.dataFim && agenda.dataFim !== agenda.dataInicio
  );
  return (
    <li className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-[11px] font-semibold text-slate-700">
          {formatDiaCard(agenda.dataInicio)}
        </p>
        <p className="text-[11px] font-semibold tabular-nums text-teal-800">
          {horaTexto(agenda)}
        </p>
        <p className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-900">
          {agenda.tipoRegistro}
        </p>
        {multiDia ? (
          <p className="text-[11px] text-slate-500">{dataTexto(agenda)}</p>
        ) : null}
      </div>
      <p className="mt-1.5 line-clamp-3 text-sm font-semibold leading-snug text-slate-900">
        {agenda.assunto}
      </p>
      <p className="mt-1 line-clamp-1 text-xs text-slate-600">
        {agenda.ministroNome}
        {agenda.orgao ? ` · ${agenda.orgao}` : ""}
      </p>
      {agenda.local ? (
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{agenda.local}</p>
      ) : null}
      {agenda.url ? (
        <a
          href={agenda.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto pt-2 text-xs font-medium text-teal-700 underline-offset-2 hover:underline"
        >
          Ver no e-Agendas
        </a>
      ) : null}
    </li>
  );
}

export function AgendasMinistrosPanel() {
  const [modo, setModo] = useState<AgendasMinistrosModo>("proximas");
  const [rows, setRows] = useState<AgendaMinistroCard[]>([]);
  const [tokenConfigured, setTokenConfigured] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(
    async (forceRefresh: boolean, modoAtual: AgendasMinistrosModo) => {
      setErro(null);
      setCarregando(true);
      try {
        const res = await loadAgendasMinistrosAction({
          forceRefresh,
          modo: modoAtual,
        });
        if (!res.ok) {
          setErro(res.error);
          setRows([]);
          return;
        }
        setRows(res.rows);
        setTokenConfigured(res.tokenConfigured);
      } catch (e) {
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar as agendas dos ministros."
        );
        setRows([]);
      } finally {
        setCarregando(false);
      }
    },
    []
  );

  useEffect(() => {
    void carregar(false, modo);
  }, [carregar, modo]);

  const filtradas = useMemo(() => {
    const q = filtro.trim().toLocaleLowerCase("pt-BR");
    if (!q) return rows;
    return rows.filter((agenda) => {
      const hay = [
        agenda.ministroNome,
        agenda.assunto,
        agenda.orgao,
        agenda.cargo,
        agenda.tipoRegistro,
        agenda.local,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return hay.includes(q);
    });
  }, [filtro, rows]);

  const ordenadas = useMemo(() => {
    const dir = modo === "passadas" ? -1 : 1;
    return [...filtradas].sort((a, b) => {
      const da = a.dataInicio ?? "";
      const db = b.dataInicio ?? "";
      if (da !== db) return da.localeCompare(db) * dir;
      const ha = a.horaInicio ?? "99:99";
      const hb = b.horaInicio ?? "99:99";
      if (ha !== hb) return ha.localeCompare(hb) * dir;
      return a.ministroNome.localeCompare(b.ministroNome, "pt-BR");
    });
  }, [filtradas, modo]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          disabled={carregando}
          onClick={() => {
            void carregar(true, modo);
          }}
          className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {carregando ? "Carregando..." : "Atualizar agendas"}
        </button>
        <div
          className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-sm"
          role="group"
          aria-label="Período das agendas"
        >
          <button
            type="button"
            onClick={() => setModo("proximas")}
            className={
              modo === "proximas"
                ? "rounded-md bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900"
                : "rounded-md px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            }
          >
            Próximas
          </button>
          <button
            type="button"
            onClick={() => setModo("passadas")}
            className={
              modo === "passadas"
                ? "rounded-md bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900"
                : "rounded-md px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            }
          >
            Passadas
          </button>
        </div>
        <input
          type="search"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Filtrar por ministro, órgão ou assunto"
          className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25"
          aria-label="Filtrar agendas dos ministros"
        />
      </div>

      {erro ? (
        <div
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {erro}
        </div>
      ) : null}

      {!tokenConfigured && !carregando ? (
        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Token do e-Agendas não configurado neste ambiente. A lista mostra só
          o que já estiver gravado.
        </p>
      ) : null}

      {!carregando && filtradas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-12 text-center text-sm text-slate-500">
          {rows.length === 0
            ? modo === "proximas"
              ? `Nenhum compromisso publicado para os próximos ${RADAR_AGENDAS_DAYS} dias.`
              : "Nenhum compromisso passado gravado neste período."
            : "Nenhum compromisso corresponde ao filtro."}
        </p>
      ) : null}

      {ordenadas.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ordenadas.map((agenda) => (
            <AgendaMinistroCardItem key={agenda.id} agenda={agenda} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
