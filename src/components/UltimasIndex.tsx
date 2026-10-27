"use client";

import { useMemo, useState } from "react";
import type { UltimaReportagem } from "@/lib/viva-ultimas";

const FUSO = "America/Sao_Paulo";

function normalizarBusca(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function chaveDia(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function deslocarChaveDia(chave: string, dias: number): string {
  const [ano, mes, dia] = chave.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias, 15, 0, 0));
  return chaveDia(data.toISOString());
}

function capitalizar(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function rotuloDia(chave: string, hoje: string): string {
  const [ano, mes, dia] = chave.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia, 15, 0, 0));
  const calendario = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "numeric",
    month: "long",
  }).format(data);
  if (chave === hoje) return `Hoje, ${calendario}`;
  if (chave === deslocarChaveDia(hoje, -1)) return `Ontem, ${calendario}`;
  const semana = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    weekday: "long",
  }).format(data);
  return `${capitalizar(semana)}, ${calendario}`;
}

function horaPublicacao(iso: string): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const hora = partes.find((parte) => parte.type === "hour")?.value ?? "00";
  const minuto = partes.find((parte) => parte.type === "minute")?.value ?? "00";
  return `${hora}h${minuto}`;
}

function horaAtualizacao(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function UltimasIndex({
  itens,
  editorias,
  atualizadoEm,
  avisos,
}: {
  itens: UltimaReportagem[];
  editorias: string[];
  atualizadoEm: string;
  avisos: string[];
}) {
  const [editoriaAtiva, setEditoriaAtiva] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const hoje = chaveDia(new Date().toISOString());
  const consulta = normalizarBusca(busca.trim());

  const filtradas = useMemo(() => {
    return itens.filter((item) => {
      if (editoriaAtiva && item.editoria !== editoriaAtiva) return false;
      if (!consulta) return true;
      const alvo = normalizarBusca(
        [item.titulo, item.subtitulo ?? "", item.autor ?? "", item.editoria].join(
          " "
        )
      );
      return alvo.includes(consulta);
    });
  }, [consulta, editoriaAtiva, itens]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, UltimaReportagem[]>();
    for (const item of filtradas) {
      const chave = chaveDia(item.publicadoEm);
      const lista = mapa.get(chave);
      if (lista) lista.push(item);
      else mapa.set(chave, [item]);
    }
    return [...mapa.entries()];
  }, [filtradas]);

  const chipBase =
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

  return (
    <div>
      {avisos.length > 0 ? (
        <p
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          {avisos.join(" ")}
        </p>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{filtradas.length}</span>{" "}
          {filtradas.length === 1 ? "reportagem" : "reportagens"}
          {editoriaAtiva || consulta ? " neste filtro" : " nos últimos 7 dias"}
          <span className="text-slate-400">
            {" "}
            · atualizado às {horaAtualizacao(atualizadoEm)}
          </span>
        </p>
        <label className="block w-full sm:max-w-xs">
          <span className="sr-only">Buscar reportagem</span>
          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar título ou repórter"
            autoComplete="off"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          />
        </label>
      </div>

      <div
        className="mb-5 flex flex-wrap gap-2"
        role="group"
        aria-label="Filtrar por editoria"
      >
        <button
          type="button"
          aria-pressed={editoriaAtiva === null}
          onClick={() => setEditoriaAtiva(null)}
          className={
            editoriaAtiva === null
              ? `${chipBase} border-blue-600 bg-blue-50 text-blue-900`
              : `${chipBase} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`
          }
        >
          Todas
        </button>
        {editorias.map((editoria) => {
          const ativa = editoriaAtiva === editoria;
          return (
            <button
              key={editoria}
              type="button"
              aria-pressed={ativa}
              onClick={() => setEditoriaAtiva(ativa ? null : editoria)}
              className={
                ativa
                  ? `${chipBase} border-blue-600 bg-blue-50 text-blue-900`
                  : `${chipBase} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`
              }
            >
              {editoria}
            </button>
          );
        })}
      </div>

      {grupos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Nenhuma reportagem com esse filtro.
        </p>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {grupos.map(([chave, reportagens], index) => (
            <section key={chave} aria-labelledby={`dia-${chave}`}>
              <h2
                id={`dia-${chave}`}
                className={`sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 ${
                  index === 0 ? "rounded-t-xl" : ""
                }`}
              >
                {rotuloDia(chave, hoje)}
                <span className="ml-2 font-medium text-slate-500">
                  {reportagens.length}
                </span>
              </h2>
              <ul>
                {reportagens.map((item) => (
                  <li
                    key={item.link}
                    className="border-b border-slate-100 px-4 py-3 last:border-b-0"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <time
                        dateTime={item.publicadoEm}
                        className="text-xs font-medium tabular-nums text-slate-500"
                      >
                        {horaPublicacao(item.publicadoEm)}
                      </time>
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-900">
                        {item.editoria}
                      </span>
                      {item.autor ? (
                        <span className="text-xs text-slate-500">Por {item.autor}</span>
                      ) : null}
                    </div>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-sm font-semibold leading-snug text-slate-900 underline-offset-2 hover:text-blue-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      {item.titulo}
                    </a>
                    {item.subtitulo ? (
                      <p className="mt-0.5 text-sm leading-snug text-slate-600">
                        {item.subtitulo}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
