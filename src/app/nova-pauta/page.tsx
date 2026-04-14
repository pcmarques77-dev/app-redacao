"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { isEditorRole, isSuperAdminEmail } from "@/lib/admin-acl";
import {
  createPautaAction,
  getPautaSessionAction,
} from "@/app/actions/pautas";
import { EDITORIA_OPTIONS, STATUS_OPTIONS } from "@/lib/pauta-form-options";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Último dia útil (seg–sex) do mês corrente, apenas data (YYYY-MM-DD) para Postgres.
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
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const ALLOWED_MIME = new Set([
  "application/pdf",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "image/jpeg",
  "image/png",
]);

const ALLOWED_EXT = new Set(["pdf", "mp3", "wav", "jpg", "jpeg", "png"]);

function isAllowedFile(file: File): boolean {
  if (file.type && ALLOWED_MIME.has(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext != null && ALLOWED_EXT.has(ext);
}

function cleanStorageFileName(originalName: string): string {
  const base = originalName.replace(/[/\\]/g, "").trim() || "arquivo";
  const cleaned = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.-]/g, "_");
  return cleaned || "arquivo";
}

function displayNameFromUrl(url: string): string {
  try {
    const seg = decodeURIComponent(
      url.split("/").pop()?.split("?")[0] ?? "arquivo"
    );
    return seg.replace(/^\d+-/, "") || seg;
  } catch {
    return "arquivo";
  }
}

function urlMediaKind(url: string): "image" | "audio" | "pdf" | "unknown" {
  const u = url.toLowerCase();
  if (/\.(jpe?g|png)(\?|$)/.test(u)) return "image";
  if (/\.(mp3|wav)(\?|$)/.test(u)) return "audio";
  if (/\.pdf(\?|$)/.test(u)) return "pdf";
  return "unknown";
}

function IconTrash() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-500"
      aria-hidden
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function ArquivoReferenciaItem({
  url,
  onRemove,
}: {
  url: string;
  onRemove: () => void;
}) {
  const name = displayNameFromUrl(url);
  const kind = urlMediaKind(url);

  return (
    <li className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 break-all text-sm font-medium text-slate-800">
          {name}
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-red-700 shadow-sm hover:bg-red-50"
          aria-label={`Remover ${name}`}
        >
          <IconTrash />
          Remover
        </button>
      </div>
      <div className="mt-3">
        {kind === "image" && (
          <button
            type="button"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            className="block overflow-hidden rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={name}
              className="max-h-28 w-auto max-w-full object-contain"
            />
          </button>
        )}
        {kind === "audio" && (
          <audio controls className="h-8 w-full" preload="metadata">
            <source src={url} />
          </audio>
        )}
        {kind === "pdf" && (
          <div className="flex flex-wrap items-center gap-3">
            <IconDocument />
            <button
              type="button"
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              Visualizar PDF
            </button>
          </div>
        )}
        {kind === "unknown" && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-slate-700 underline hover:text-slate-900"
          >
            Abrir arquivo
          </a>
        )}
      </div>
    </li>
  );
}

type ReporterOption = {
  id: string;
  nome: string | null;
};

export default function NovaPautaPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reporters, setReporters] = useState<ReporterOption[]>([]);
  const [loadingReporters, setLoadingReporters] = useState(true);
  const [erroReporters, setErroReporters] = useState<string | null>(null);

  const [reporterId, setReporterId] = useState("");
  const [tituloProvisorio, setTituloProvisorio] = useState("");
  const [fontes, setFontes] = useState("");
  const [arquivosUrls, setArquivosUrls] = useState<string[]>([]);
  const [editoria, setEditoria] = useState("Últimas Notícias");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState("Sugerida");
  const [salvandoPauta, setSalvandoPauta] = useState(false);
  const [erroFormPauta, setErroFormPauta] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErro, setUploadErro] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [sessionCtx, setSessionCtx] = useState<{
    userId: string;
    email: string;
    funcao: string | null;
  } | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const privilegedSession = useMemo(
    () =>
      sessionCtx
        ? isSuperAdminEmail(sessionCtx.email) ||
          isEditorRole(sessionCtx.funcao)
        : false,
    [sessionCtx]
  );

  useEffect(() => {
    void getPautaSessionAction().then((r) => {
      setSessionReady(true);
      if (r.ok) {
        setSessionCtx({
          userId: r.userId,
          email: r.email,
          funcao: r.funcao,
        });
        setSessionError(null);
      } else {
        setSessionCtx(null);
        setSessionError(r.error);
      }
    });
  }, []);

  useEffect(() => {
    if (!sessionCtx || privilegedSession) return;
    setReporterId(sessionCtx.userId);
  }, [sessionCtx, privilegedSession]);

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

  const processFilesForUpload = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    const rejected = list.filter((f) => !isAllowedFile(f));
    if (rejected.length > 0) {
      setUploadErro("Use apenas PDF, MP3, WAV, JPG ou PNG.");
      return;
    }

    setUploadErro(null);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url?.trim() || !key?.trim()) {
      setUploadErro("Supabase não configurado (.env.local).");
      return;
    }

    setUploadBusy(true);
    const supabase = createBrowserClient();
    const novasUrls: string[] = [];

    try {
      let stamp = Date.now();
      for (const file of list) {
        const cleanFileName = cleanStorageFileName(file.name);
        const objectPath = `${stamp}-${cleanFileName}`;
        stamp += 1;

        const { data: upData, error: upErr } = await supabase.storage
          .from("arquivos_pauta")
          .upload(objectPath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined,
          });

        if (upErr) {
          setUploadErro(upErr.message || "Falha no upload.");
          break;
        }

        const { data: pub } = supabase.storage
          .from("arquivos_pauta")
          .getPublicUrl(upData.path);

        if (pub?.publicUrl) novasUrls.push(pub.publicUrl);
      }

      if (novasUrls.length > 0) {
        setArquivosUrls((prev) => [...prev, ...novasUrls]);
      }
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files?.length) void processFilesForUpload(files);
    },
    [processFilesForUpload]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const files = e.dataTransfer.files;
      if (files?.length) void processFilesForUpload(files);
    },
    [processFilesForUpload]
  );

  const removeArquivoAt = useCallback((index: number) => {
    setArquivosUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleCriarPauta = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setErroFormPauta(null);
      const titulo = tituloProvisorio.trim();
      if (!titulo) {
        setErroFormPauta("Informe o título provisório.");
        return;
      }
      if (privilegedSession && !reporterId.trim()) {
        setErroFormPauta("Selecione um repórter.");
        return;
      }
      if (!privilegedSession && !sessionCtx?.userId) {
        setErroFormPauta("Sessão inválida. Atualize a página e tente novamente.");
        return;
      }

      const deadlineOriginal = deadline.trim();
      const deadlineFinal = deadlineOriginal
        ? deadlineOriginal
        : getLastBusinessDayOfMonth();

      setSalvandoPauta(true);
      const insertRes = await createPautaAction({
        titulo_provisorio: titulo,
        fontes: fontes.trim() || null,
        arquivos_urls: arquivosUrls,
        editoria,
        deadline: deadlineFinal,
        status,
        reporter_id: privilegedSession
          ? reporterId.trim()
          : sessionCtx!.userId,
      });

      setSalvandoPauta(false);

      if (!insertRes.ok) {
        setErroFormPauta(insertRes.error || "Não foi possível salvar a pauta.");
        return;
      }

      router.push("/");
    },
    [
      arquivosUrls,
      deadline,
      editoria,
      fontes,
      privilegedSession,
      reporterId,
      router,
      sessionCtx,
      status,
      tituloProvisorio,
    ]
  );

  const waitingInitial =
    !sessionReady || (privilegedSession && loadingReporters);

  return (
    <div className="min-h-screen bg-slate-100/80">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8 sm:px-6 lg:max-w-3xl lg:px-8">
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

            {waitingInitial && (
              <p className="text-center text-sm text-slate-600" role="status">
                Carregando…
              </p>
            )}

            {sessionReady && sessionError && (
              <p className="text-center text-sm text-red-700" role="alert">
                {sessionError}
              </p>
            )}

            {sessionReady &&
              !sessionError &&
              !waitingInitial &&
              privilegedSession &&
              erroReporters && (
                <p className="text-center text-sm text-red-700" role="alert">
                  {erroReporters}
                </p>
              )}

            {sessionReady &&
              !sessionError &&
              !waitingInitial &&
              !(privilegedSession && erroReporters) && (
              <form className="space-y-4" onSubmit={handleCriarPauta}>
                {privilegedSession && reporters.length === 0 && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Nenhum repórter encontrado na tabela de usuários. Cadastre
                    usuários no Supabase para poder criar pautas.
                  </p>
                )}
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
                {privilegedSession ? (
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
                ) : (
                  <p className="text-sm text-slate-600">
                    Esta pauta será atribuída a você como repórter.
                  </p>
                )}
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
                    type="date"
                    value={deadline}
                    onChange={(ev) => setDeadline(ev.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Opcional. Se não informado, será usado o último dia útil do
                    mês atual.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="fontes-nova"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Fontes e links
                  </label>
                  <textarea
                    id="fontes-nova"
                    name="fontes"
                    value={fontes}
                    onChange={(ev) => setFontes(ev.target.value)}
                    rows={4}
                    placeholder="Fontes e links"
                    className="mt-1 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Arquivos de referência
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    PDF, MP3, WAV, JPG ou PNG. Os arquivos são enviados na hora para
                    o armazenamento.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.mp3,.wav,.jpg,.jpeg,.png,audio/*,image/*,application/pdf"
                    onChange={handleFileInputChange}
                    className="sr-only"
                    id="arquivos-referencia-nova"
                    disabled={uploadBusy}
                    aria-label="Selecionar arquivos de referência"
                  />
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`mt-3 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
                      dragActive
                        ? "border-slate-500 bg-slate-100"
                        : "border-slate-300 bg-white"
                    } ${uploadBusy ? "pointer-events-none opacity-60" : ""}`}
                  >
                    <p className="text-sm font-medium text-slate-700">
                      Arraste arquivos aqui
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Vários arquivos de uma vez
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadBusy}
                      className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:opacity-60"
                    >
                      Selecionar arquivos
                    </button>
                  </div>
                  {uploadBusy && (
                    <p className="mt-2 text-center text-xs text-slate-600" role="status">
                      Enviando…
                    </p>
                  )}
                  {uploadErro && (
                    <p className="mt-2 text-center text-sm text-red-700" role="alert">
                      {uploadErro}
                    </p>
                  )}
                  {arquivosUrls.length > 0 && (
                    <ul className="mt-4 space-y-3">
                      {arquivosUrls.map((u, i) => (
                        <ArquivoReferenciaItem
                          key={`${u}-${i}`}
                          url={u}
                          onRemove={() => removeArquivoAt(i)}
                        />
                      ))}
                    </ul>
                  )}
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
                {erroFormPauta && (
                  <p className="text-sm text-red-700" role="alert">
                    {erroFormPauta}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={
                      salvandoPauta ||
                      uploadBusy ||
                      (privilegedSession &&
                        (reporters.length === 0 || !reporterId.trim())) ||
                      (!privilegedSession && !sessionCtx?.userId)
                    }
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
