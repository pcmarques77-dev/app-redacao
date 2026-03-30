"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { EDITORIA_OPTIONS, STATUS_OPTIONS } from "@/lib/pauta-form-options";

type ReporterOption = {
  id: string;
  nome: string | null;
};

function deadlineToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditarPauta() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const [reporters, setReporters] = useState<ReporterOption[]>([]);
  const [tituloProvisorio, setTituloProvisorio] = useState("");
  const [editoria, setEditoria] = useState("Últimas Notícias");
  const [reporterId, setReporterId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState("Sugerida");

  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setErroCarregamento(null);

      if (!id?.trim()) {
        setErroCarregamento("ID da pauta inválido.");
        setLoading(false);
        return;
      }

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url?.trim() || !key?.trim()) {
        setErroCarregamento(
          "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local."
        );
        setLoading(false);
        return;
      }

      const supabase = createBrowserClient();

      const [repRes, pautaRes] = await Promise.all([
        supabase.from("usuarios").select("id, nome").order("nome", { ascending: true }),
        supabase
          .from("pautas")
          .select("titulo_provisorio, editoria, deadline, status, reporter_id")
          .eq("id", id)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (repRes.error) {
        setErroCarregamento(
          repRes.error.message || "Não foi possível carregar os repórteres."
        );
        setLoading(false);
        return;
      }

      if (pautaRes.error) {
        setErroCarregamento(pautaRes.error.message || "Não foi possível carregar a pauta.");
        setLoading(false);
        return;
      }

      if (!pautaRes.data) {
        setErroCarregamento("Pauta não encontrada.");
        setLoading(false);
        return;
      }

      const row = pautaRes.data as {
        titulo_provisorio: string | null;
        editoria: string | null;
        deadline: string | null;
        status: string | null;
        reporter_id: string | null;
      };

      setReporters((repRes.data as ReporterOption[]) ?? []);
      setTituloProvisorio(row.titulo_provisorio?.trim() ?? "");
      setEditoria(row.editoria?.trim() || "Últimas Notícias");
      setReporterId(row.reporter_id?.trim() ?? "");
      setDeadline(deadlineToLocalInput(row.deadline));
      setStatus(row.status?.trim() || "Sugerida");
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setErroForm(null);

      if (!id?.trim()) return;

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url?.trim() || !key?.trim()) {
        setErroForm(
          "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local."
        );
        return;
      }

      const titulo = tituloProvisorio.trim();
      if (!titulo) {
        setErroForm("Informe o título provisório.");
        return;
      }
      if (!reporterId.trim()) {
        setErroForm("Selecione um repórter.");
        return;
      }

      const deadlineOriginal = deadline.trim();
      const anoAtual = new Date().getFullYear();
      const deadlineFinal = deadlineOriginal
        ? deadlineOriginal
        : `${anoAtual}-12-31T18:00`;

      setSalvando(true);
      const supabase = createBrowserClient();
      const { error: updateErr } = await supabase
        .from("pautas")
        .update({
          titulo_provisorio: titulo,
          editoria,
          deadline: deadlineFinal,
          status,
          reporter_id: reporterId.trim(),
        })
        .eq("id", id);

      setSalvando(false);

      if (updateErr) {
        setErroForm(updateErr.message || "Não foi possível salvar as alterações.");
        return;
      }

      router.push("/");
    },
    [deadline, editoria, id, reporterId, router, status, tituloProvisorio]
  );

  const formularioPronto = !loading && !erroCarregamento;

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
              Editar Pauta
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Atualize os dados da pauta e salve para aplicar no sistema.
            </p>
          </header>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {loading && (
              <p className="text-center text-sm text-slate-600" role="status">
                Carregando…
              </p>
            )}

            {!loading && erroCarregamento && (
              <p className="text-center text-sm text-red-700" role="alert">
                {erroCarregamento}
              </p>
            )}

            {formularioPronto && (
              <form className="space-y-4" onSubmit={handleSubmit}>
                {reporters.length === 0 && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Nenhum repórter encontrado. Cadastre usuários no Supabase.
                  </p>
                )}
                <div>
                  <label
                    htmlFor="edit-reporter"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Repórter
                  </label>
                  <select
                    id="edit-reporter"
                    name="reporter_id"
                    value={reporterId}
                    onChange={(ev) => setReporterId(ev.target.value)}
                    required
                    disabled={reporters.length === 0}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50"
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
                    htmlFor="edit-titulo"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Título provisório
                  </label>
                  <input
                    id="edit-titulo"
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
                    htmlFor="edit-editoria"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Editoria
                  </label>
                  <select
                    id="edit-editoria"
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
                    htmlFor="edit-status"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Status
                  </label>
                  <select
                    id="edit-status"
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
                    htmlFor="edit-deadline"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Prazo (deadline)
                  </label>
                  <input
                    id="edit-deadline"
                    name="deadline"
                    type="datetime-local"
                    value={deadline}
                    onChange={(ev) => setDeadline(ev.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Opcional. Se vazio, será usado 31/12 do ano atual às 18:00.
                  </p>
                </div>
                {erroForm && (
                  <p className="text-sm text-red-700" role="alert">
                    {erroForm}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={salvando || reporters.length === 0}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {salvando ? "Salvando…" : "Salvar"}
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
