"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import { canUserEditOrDeletePauta } from "@/lib/admin-acl";
import {
  deletePautasAction,
  getPautaSessionAction,
  updatePautaAction,
} from "@/app/actions/pautas";
import { PAUTA_ACCESS_DENIED } from "@/lib/pautas-shared";
import { parseDeadlineToYmd } from "@/lib/deadline-date";
import { EDITORIA_OPTIONS, STATUS_OPTIONS } from "@/lib/pauta-form-options";

type ReporterOption = {
  id: string;
  nome: string | null;
};

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

function normalizeArquivosUrls(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string" && x.trim() !== "");
  }
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p)
        ? p.filter((x): x is string => typeof x === "string" && x.trim() !== "")
        : [];
    } catch {
      return [];
    }
  }
  return [];
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
  showRemove = true,
}: {
  url: string;
  onRemove: () => void;
  showRemove?: boolean;
}) {
  const name = displayNameFromUrl(url);
  const kind = urlMediaKind(url);

  return (
    <li className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 break-all text-sm font-medium text-slate-800">
          {name}
        </p>
        {showRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-red-700 shadow-sm hover:bg-red-50"
            aria-label={`Remover ${name}`}
          >
            <IconTrash />
            Remover
          </button>
        ) : null}
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

export default function EditarPauta() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const [reporters, setReporters] = useState<ReporterOption[]>([]);
  const [tituloProvisorio, setTituloProvisorio] = useState("");
  const [fontes, setFontes] = useState("");
  const [editoria, setEditoria] = useState("Últimas Notícias");
  const [reporterId, setReporterId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState("Sugerida");
  const [arquivosUrls, setArquivosUrls] = useState<string[]>([]);

  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErro, setUploadErro] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [sessionCtx, setSessionCtx] = useState<{
    userId: string;
    email: string;
    funcao: string | null;
  } | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [rowReporterId, setRowReporterId] = useState<string | null>(null);

  useEffect(() => {
    void getPautaSessionAction().then((r) => {
      setSessionReady(true);
      if (r.ok) {
        setSessionCtx({
          userId: r.userId,
          email: r.email,
          funcao: r.funcao,
        });
      } else {
        setSessionCtx(null);
      }
    });
  }, []);

  const canEditOrDelete = useMemo(() => {
    if (!sessionCtx) return false;
    return canUserEditOrDeletePauta({
      currentUserId: sessionCtx.userId,
      currentUserEmail: sessionCtx.email,
      currentUserRole: sessionCtx.funcao,
      pautaReporterId: rowReporterId,
    });
  }, [sessionCtx, rowReporterId]);

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
          .select(
            "titulo_provisorio, fontes, arquivos_urls, editoria, deadline, status, reporter_id"
          )
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
        fontes: string | null;
        arquivos_urls: unknown;
        editoria: string | null;
        deadline: string | null;
        status: string | null;
        reporter_id: string | null;
      };

      setReporters((repRes.data as ReporterOption[]) ?? []);
      setTituloProvisorio(row.titulo_provisorio?.trim() ?? "");
      setFontes(row.fontes?.trim() ?? "");
      setArquivosUrls(normalizeArquivosUrls(row.arquivos_urls));
      setEditoria(row.editoria?.trim() || "Últimas Notícias");
      setReporterId(row.reporter_id?.trim() ?? "");
      setRowReporterId(row.reporter_id?.trim() ? row.reporter_id.trim() : null);
      setDeadline(parseDeadlineToYmd(row.deadline) ?? "");
      setStatus(row.status?.trim() || "Sugerida");
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const processFilesForUpload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      const rejected = list.filter((f) => !isAllowedFile(f));
      if (rejected.length > 0) {
        setUploadErro(
          "Use apenas PDF, MP3, WAV, JPG ou PNG."
        );
        return;
      }

      setUploadErro(null);
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url?.trim() || !key?.trim()) {
        setUploadErro("Supabase não configurado (.env.local).");
        return;
      }

      if (!id?.trim()) return;

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
    },
    [id]
  );

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

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setErroForm(null);

      if (!id?.trim()) return;

      if (!sessionCtx) {
        setErroForm("Sessão inválida. Atualize a página e tente novamente.");
        return;
      }
      if (
        !canUserEditOrDeletePauta({
          currentUserId: sessionCtx.userId,
          currentUserEmail: sessionCtx.email,
          currentUserRole: sessionCtx.funcao,
          pautaReporterId: rowReporterId,
        })
      ) {
        setErroForm(PAUTA_ACCESS_DENIED);
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
        : `${anoAtual}-12-31`;

      setSalvando(true);
      const updateRes = await updatePautaAction(id, {
        titulo_provisorio: titulo,
        fontes: fontes.trim() || null,
        arquivos_urls: arquivosUrls,
        editoria,
        deadline: deadlineFinal,
        status,
        reporter_id: reporterId.trim(),
      });

      setSalvando(false);

      if (!updateRes.ok) {
        setErroForm(
          updateRes.error === PAUTA_ACCESS_DENIED
            ? PAUTA_ACCESS_DENIED
            : updateRes.error || "Não foi possível salvar as alterações."
        );
        return;
      }

      router.push("/");
    },
    [
      arquivosUrls,
      deadline,
      editoria,
      fontes,
      id,
      reporterId,
      rowReporterId,
      router,
      sessionCtx,
      status,
      tituloProvisorio,
    ]
  );

  const handleExcluir = useCallback(async () => {
    if (!id?.trim()) return;
    if (
      !window.confirm(
        "Excluir esta pauta permanentemente? Esta ação não pode ser desfeita."
      )
    ) {
      return;
    }
    setErroForm(null);
    if (!sessionCtx) {
      setErroForm("Sessão inválida. Atualize a página e tente novamente.");
      return;
    }
    if (
      !canUserEditOrDeletePauta({
        currentUserId: sessionCtx.userId,
        currentUserEmail: sessionCtx.email,
        currentUserRole: sessionCtx.funcao,
        pautaReporterId: rowReporterId,
      })
    ) {
      setErroForm(PAUTA_ACCESS_DENIED);
      return;
    }
    setExcluindo(true);
    const delRes = await deletePautasAction([id]);
    setExcluindo(false);
    if (!delRes.ok) {
      setErroForm(
        delRes.error === PAUTA_ACCESS_DENIED
          ? PAUTA_ACCESS_DENIED
          : delRes.error || "Não foi possível excluir a pauta."
      );
      return;
    }
    router.push("/");
  }, [id, rowReporterId, router, sessionCtx]);

  const formularioPronto = !loading && !erroCarregamento;
  const editable = sessionReady && canEditOrDelete;

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
              Apuração da pauta
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Fontes, referências e dados da pauta — salve para sincronizar com o
              painel.
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
                {sessionReady && !canEditOrDelete && (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    Você pode consultar os dados desta pauta, mas não possui
                    permissão para alterá-la ou excluí-la.
                  </p>
                )}
                {reporters.length === 0 && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Nenhum repórter encontrado. Cadastre usuários no Supabase.
                  </p>
                )}
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
                    readOnly={!editable}
                    required
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 read-only:bg-slate-50 read-only:text-slate-700"
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
                    disabled={!editable}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50"
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
                    disabled={!editable || reporters.length === 0}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50"
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
                    htmlFor="edit-deadline"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Prazo (deadline)
                  </label>
                  <input
                    id="edit-deadline"
                    name="deadline"
                    type="date"
                    value={deadline}
                    onChange={(ev) => setDeadline(ev.target.value)}
                    readOnly={!editable}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 read-only:bg-slate-50"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Opcional. Se vazio, será usado 31/12 do ano atual.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="edit-fontes"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Fontes e links
                  </label>
                  <textarea
                    id="edit-fontes"
                    name="fontes"
                    value={fontes}
                    onChange={(ev) => setFontes(ev.target.value)}
                    readOnly={!editable}
                    rows={4}
                    placeholder="Fontes e links"
                    className="mt-1 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 read-only:bg-slate-50"
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
                    id="arquivos-referencia-input"
                    disabled={uploadBusy || !editable}
                    aria-label="Selecionar arquivos de referência"
                  />
                  <div
                    onDragOver={editable ? handleDragOver : undefined}
                    onDragLeave={editable ? handleDragLeave : undefined}
                    onDrop={editable ? handleDrop : undefined}
                    className={`mt-3 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
                      dragActive
                        ? "border-slate-500 bg-slate-100"
                        : "border-slate-300 bg-white"
                    } ${uploadBusy || !editable ? "pointer-events-none opacity-60" : ""}`}
                  >
                    <p className="text-sm font-medium text-slate-700">
                      {editable
                        ? "Arraste arquivos aqui"
                        : "Upload disponível apenas para quem pode editar a pauta."}
                    </p>
                    {editable && (
                      <p className="mt-1 text-xs text-slate-500">
                        Vários arquivos de uma vez
                      </p>
                    )}
                    {editable && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadBusy}
                        className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:opacity-60"
                      >
                        Selecionar arquivos
                      </button>
                    )}
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
                          showRemove={editable}
                        />
                      ))}
                    </ul>
                  )}
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
                    disabled={!editable}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    {STATUS_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {erroForm && (
                  <p className="text-sm text-red-700" role="alert">
                    {erroForm}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 pt-2">
                  {canEditOrDelete ? (
                    <button
                      type="submit"
                      disabled={
                        salvando ||
                        excluindo ||
                        reporters.length === 0 ||
                        uploadBusy
                      }
                      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {salvando ? "Salvando…" : "Salvar"}
                    </button>
                  ) : null}
                  <Link
                    href="/"
                    className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Cancelar
                  </Link>
                </div>
                {canEditOrDelete ? (
                  <div className="mt-6 border-t border-slate-200 pt-4">
                    <button
                      type="button"
                      onClick={() => void handleExcluir()}
                      disabled={salvando || excluindo || uploadBusy}
                      className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 shadow-sm transition-colors hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {excluindo ? "Excluindo…" : "Excluir pauta"}
                    </button>
                    <p className="mt-2 text-xs text-slate-500">
                      Remove o registro do painel. Não é possível desfazer.
                    </p>
                  </div>
                ) : null}
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
