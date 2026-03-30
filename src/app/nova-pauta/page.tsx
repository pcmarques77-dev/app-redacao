"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { EDITORIA_OPTIONS, STATUS_OPTIONS } from "@/lib/pauta-form-options";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Último dia útil (seg–sex) do mês corrente, às 18:00, no formato aceito pelo formulário/Postgres.
 */
function getLastBusinessDayOfMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const lastOfMonth = new Date(y, m + 1, 0);
  let day = lastOfMonth.getDate();
  const dow = lastOfMonth.getDay();
  if (dow === 6) day -= 1;
  else if (dow === 0) day -= 2;
  const d = new Date(y, m, day);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T18:00`;
}

type ReporterOption = {
  id: string;
  nome: string | null;
};

export default function NovaPautaPage() {
  const router = useRouter();

  const [reporters, setReporters] = useState<ReporterOption[]>([]);
  const [loadingReporters, setLoadingReporters] = useState(true);
  const [erroReporters, setErroReporters] = useState<string | null>(null);

  const [reporterId, setReporterId] = useState("");
  const [tituloProvisorio, setTituloProvisorio] = useState("");
  const [editoria, setEditoria] = useState("Últimas Notícias");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState("Sugerida");
  const [salvandoPauta, setSalvandoPauta] = useState(false);
  const [erroFormPauta, setErroFormPauta] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url?.trim() || !key?.trim()) {
      setErroReporters(
        "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local."
      );
      setLoadingReporters(false);
      return;
    }

    const supabase = createBrowserClient();
    void (async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nome")
        .order("nome", { ascending: true });

      if (cancelled) return;
      setLoadingReporters(false);
      if (error) {
        setErroReporters(error.message || "Não foi possível carregar os repórteres.");
        return;
      }
      setReporters((data as ReporterOption[]) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCriarPauta = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setErroFormPauta(null);
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url?.trim() || !key?.trim()) {
        setErroFormPauta(
          "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local."
        );
        return;
      }
      const titulo = tituloProvisorio.trim();
      if (!titulo) {
        setErroFormPauta("Informe o título provisório.");
        return;
      }
      if (!reporterId.trim()) {
        setErroFormPauta("Selecione um repórter.");
        return;
      }

      const deadlineOriginal = deadline.trim();
      const deadlineFinal = deadlineOriginal
        ? deadlineOriginal
        : getLastBusinessDayOfMonth();

      setSalvandoPauta(true);
      const supabase = createBrowserClient();
      const { error: insertErr } = await supabase.from("pautas").insert({
        titulo_provisorio: titulo,
        editoria,
        deadline: deadlineFinal,
        status,
        reporter_id: reporterId.trim(),
      });

      setSalvandoPauta(false);

      if (insertErr) {
        setErroFormPauta(insertErr.message || "Não foi possível salvar a pauta.");
        return;
      }

      router.push("/");
    },
    [deadline, editoria, reporterId, router, status, tituloProvisorio]
  );

  return (
    <div className="min-h-screen bg-slate-100/80">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            <span aria-hidden>←</span> Voltar
          </Link>
        </div>

        <div className="flex flex-1 flex-col justify-center pb-12">
          <header className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Nova pauta
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Preencha os dados para registrar uma nova pauta na redação.
            </p>
          </header>

          <section
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            aria-labelledby="nova-pauta-form-heading"
          >
            <h2 id="nova-pauta-form-heading" className="sr-only">
              Formulário de nova pauta
            </h2>

            {loadingReporters && (
              <p className="text-center text-sm text-slate-600" role="status">
                Carregando repórteres...
              </p>
            )}

            {!loadingReporters && erroReporters && (
              <p className="text-center text-sm text-red-700" role="alert">
                {erroReporters}
              </p>
            )}

            {!loadingReporters && !erroReporters && (
              <form className="space-y-4" onSubmit={handleCriarPauta}>
                {reporters.length === 0 && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Nenhum repórter encontrado na tabela de usuários. Cadastre
                    usuários no Supabase para poder criar pautas.
                  </p>
                )}
                <div>
                  <label
                    htmlFor="reporter-id"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Repórter
                  </label>
                  <select
                    id="reporter-id"
                    name="reporter_id"
                    value={reporterId}
                    onChange={(ev) => setReporterId(ev.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  >
                    <option value="">Selecione o repórter</option>
                    {reporters.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome?.trim() || "Sem nome"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="titulo-provisorio"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Título provisório
                  </label>
                  <input
                    id="titulo-provisorio"
                    name="titulo_provisorio"
                    type="text"
                    value={tituloProvisorio}
                    onChange={(ev) => setTituloProvisorio(ev.target.value)}
                    required
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    placeholder="Ex.: Entrevista com o prefeito"
                  />
                </div>
                <div>
                  <label
                    htmlFor="editoria-pauta"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Editoria
                  </label>
                  <select
                    id="editoria-pauta"
                    name="editoria"
                    value={editoria}
                    onChange={(ev) => setEditoria(ev.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  >
                    {EDITORIA_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="status-pauta"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Status
                  </label>
                  <select
                    id="status-pauta"
                    name="status"
                    value={status}
                    onChange={(ev) => setStatus(ev.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  >
                    {STATUS_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="deadline-nova"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Prazo (deadline)
                  </label>
                  <input
                    id="deadline-nova"
                    name="deadline"
                    type="datetime-local"
                    value={deadline}
                    onChange={(ev) => setDeadline(ev.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Opcional. Se não informado, será usado o último dia útil do
                    mês atual às 18:00.
                  </p>
                </div>
                {erroFormPauta && (
                  <p className="text-sm text-red-700" role="alert">
                    {erroFormPauta}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={salvandoPauta || reporters.length === 0}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {salvandoPauta ? "Salvando…" : "Salvar"}
                  </button>
                  <Link
                    href="/"
                    className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Cancelar
                  </Link>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
