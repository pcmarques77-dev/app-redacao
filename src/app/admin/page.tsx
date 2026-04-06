"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  deleteUsuariosRowAction,
  listUsuariosTableAction,
  updateUsuariosRowAction,
  type UsuarioTableRow,
} from "@/app/actions/admin";
import { createBrowserClient } from "@/lib/supabase/client";

function isoToDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function AdminUsuariosPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<UsuarioTableRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [banner, setBanner] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const [editing, setEditing] = useState<UsuarioTableRow | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editFuncao, setEditFuncao] = useState("");
  const [editDataCriacao, setEditDataCriacao] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refreshRows = useCallback(async () => {
    setListError(null);
    setLoadingList(true);
    const res = await listUsuariosTableAction();
    setLoadingList(false);
    if (!res.ok) {
      setListError(res.error);
      setRows([]);
      return;
    }
    setRows(res.rows);
  }, []);

  useEffect(() => {
    void refreshRows();
  }, [refreshRows]);

  useEffect(() => {
    if (searchParams.get("criado") === "1") {
      setBanner({ type: "ok", text: "Usuário criado com sucesso." });
      router.replace("/admin", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    const supabase = createBrowserClient();
    void supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  const openEdit = useCallback((row: UsuarioTableRow) => {
    setEditing(row);
    setEditNome(row.nome?.trim() ?? "");
    setEditEmail(row.email?.trim() ?? "");
    setEditFuncao(row.funcao?.trim() ?? "");
    setEditDataCriacao(isoToDatetimeLocalValue(row.data_criacao));
    setBanner(null);
  }, []);

  const closeEdit = useCallback(() => {
    if (salvandoEdicao || deletingId) return;
    setEditing(null);
  }, [salvandoEdicao, deletingId]);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !salvandoEdicao && !deletingId) {
        setEditing(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, salvandoEdicao, deletingId]);

  const handleAtualizar = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!editing) return;
      setBanner(null);
      setSalvandoEdicao(true);
      const res = await updateUsuariosRowAction(editing.id, {
        nome: editNome,
        email: editEmail,
        funcao: editFuncao,
        data_criacao: editDataCriacao,
      });
      setSalvandoEdicao(false);
      if (!res.ok) {
        setBanner({ type: "err", text: res.error });
        return;
      }
      setBanner({ type: "ok", text: "Registro atualizado." });
      setEditing(null);
      void refreshRows();
    },
    [editing, editNome, editEmail, editFuncao, editDataCriacao, refreshRows]
  );

  const handleExcluir = useCallback(
    async (row: UsuarioTableRow) => {
      if (
        !window.confirm(
          "Remover esta linha de public.usuarios? Isso não remove o usuário do Authentication."
        )
      ) {
        return;
      }
      setBanner(null);
      setDeletingId(row.id);
      const res = await deleteUsuariosRowAction(row.id);
      setDeletingId(null);
      if (!res.ok) {
        setBanner({ type: "err", text: res.error });
        return;
      }
      setBanner({ type: "ok", text: "Registro removido da tabela." });
      if (editing?.id === row.id) setEditing(null);
      void refreshRows();
    },
    [editing?.id, refreshRows]
  );

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-100/80">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
        <header className="mb-3 shrink-0 flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Admin
            </h1>
            <p className="mt-0.5 max-w-2xl text-xs text-slate-600 sm:text-sm">
              Cadastro direto em{" "}
              <code className="rounded bg-slate-200/80 px-1 text-xs">
                public.usuarios
              </code>
              : criar, listar, editar e excluir linhas. Contas em Authentication
              não são criadas nem apagadas por aqui; você pode alinhar o Auth
              depois a partir destes dados.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Voltar ao painel
            </Link>
          </div>
        </header>

        {banner && (
          <div
            className={`mb-3 shrink-0 rounded-lg border px-3 py-2 text-sm ${
              banner.type === "err"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
            role={banner.type === "err" ? "alert" : "status"}
          >
            {banner.text}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain lg:overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 sm:px-5">
                <h2 className="text-sm font-semibold text-slate-800">
                  Usuários
                </h2>
                <Link
                  href="/admin/novo-usuario"
                  className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
                >
                  Criar usuário
                </Link>
              </div>
              {loadingList && (
                <p className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">
                  Carregando…
                </p>
              )}
              {!loadingList && listError && (
                <p className="px-4 py-5 text-center text-sm text-red-700 sm:px-5">
                  {listError}
                </p>
              )}
              {!loadingList && !listError && rows.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">
                  Nenhum registro na tabela.
                </p>
              )}
              {!loadingList && !listError && rows.length > 0 && (
                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                  <table className="w-full table-fixed divide-y divide-slate-200 text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                      <tr>
                        <th className="w-[28%] px-3 py-2.5 font-semibold text-slate-700 sm:px-4">
                          Nome
                        </th>
                        <th className="w-[32%] px-3 py-2.5 font-semibold text-slate-700 sm:px-4">
                          E-mail
                        </th>
                        <th className="w-[22%] px-3 py-2.5 font-semibold text-slate-700 sm:px-4">
                          Função
                        </th>
                        <th className="w-[14%] px-3 py-2.5 font-semibold text-slate-700 sm:px-4">
                          <span className="sr-only">Ações</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/80">
                          <td className="px-3 py-2.5 align-middle sm:px-4">
                            <span className="line-clamp-2 break-words font-medium text-slate-900">
                              {r.nome?.trim() || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 align-middle sm:px-4">
                            <span className="line-clamp-2 break-all text-slate-700">
                              {r.email?.trim() || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 align-middle sm:px-4">
                            <span className="line-clamp-2 break-words text-slate-600">
                              {r.funcao?.trim() || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 align-middle sm:px-4">
                            <button
                              type="button"
                              onClick={() => openEdit(r)}
                              className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <PencilIcon />
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-usuario-titulo"
          onClick={() => closeEdit()}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h2
                id="edit-usuario-titulo"
                className="text-lg font-semibold text-slate-900"
              >
                Editar registro
              </h2>
              <p className="mt-1 break-all font-mono text-xs text-slate-500">
                {editing.id}
              </p>
            </div>
            <form onSubmit={handleAtualizar} className="px-5 py-4">
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="edit-nome"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Nome
                  </label>
                  <input
                    id="edit-nome"
                    type="text"
                    required
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-email"
                    className="block text-sm font-medium text-slate-700"
                  >
                    E-mail
                  </label>
                  <input
                    id="edit-email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-funcao"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Função
                  </label>
                  <input
                    id="edit-funcao"
                    type="text"
                    value={editFuncao}
                    onChange={(e) => setEditFuncao(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-data"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Data de cadastro (vazio = limpar)
                  </label>
                  <input
                    id="edit-data"
                    type="datetime-local"
                    value={editDataCriacao}
                    onChange={(e) => setEditDataCriacao(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                  />
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  disabled={
                    editing.id === currentUserId ||
                    deletingId === editing.id ||
                    salvandoEdicao
                  }
                  onClick={() => void handleExcluir(editing)}
                  className="order-2 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:order-1"
                >
                  {deletingId === editing.id ? "Excluindo…" : "Excluir"}
                </button>
                <div className="order-1 flex flex-wrap justify-end gap-2 sm:order-2">
                  <button
                    type="button"
                    onClick={closeEdit}
                    disabled={salvandoEdicao || deletingId === editing.id}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={
                      salvandoEdicao || deletingId === editing.id
                    }
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {salvandoEdicao ? "Salvando…" : "Salvar"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminUsuariosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-slate-100/80 text-sm text-slate-600">
          Carregando…
        </div>
      }
    >
      <AdminUsuariosPageContent />
    </Suspense>
  );
}
