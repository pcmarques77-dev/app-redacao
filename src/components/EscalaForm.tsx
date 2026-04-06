"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { deleteEscala } from "@/app/actions/escalas";
import { createBrowserClient } from "@/lib/supabase/client";

export const ESCALA_TIPO_COORDENACAO = "Coordenação";
export const ESCALA_TIPO_PLANTAO = "Plantão";
export const ESCALA_TIPO_FERIAS = "Férias";

export type EscalaUsuarioOption = {
  id: string;
  nome: string | null;
};

/** Dados de uma linha existente em `escalas` (edição / exclusão). */
export type EscalaInitialValues = {
  id: string;
  tipo: string | null;
  usuario_id: string;
  data_inicio: string | null;
  data_fim: string | null;
  horario: string | null;
};

export type EscalaFormProps = {
  variant: "page" | "embedded";
  /** YYYY-MM-DD — preenche data(s) ao escolher o tipo (modal / dia clicado). */
  defaultDateYmd?: string;
  /** Entrada existente: formulário pré-preenchido e permite excluir. */
  initialEscala?: EscalaInitialValues | null;
  /** Se informado, não busca `usuarios` (ex.: repórteres já carregados no modal). */
  usuarios?: EscalaUsuarioOption[];
  /** Quando `usuarios` vem do pai (ex.: modal), espere a lista terminar de carregar. */
  usuariosLoading?: boolean;
  onSuccess?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
  idPrefix?: string;
};

function serialize(
  tipo: string,
  usuarioId: string,
  dataCoordenacao: string,
  dataPlantao: string,
  horario: string,
  dataInicioFerias: string,
  dataFimFerias: string
) {
  return JSON.stringify({
    tipo,
    usuarioId,
    dataCoordenacao,
    dataPlantao,
    horario,
    dataInicioFerias,
    dataFimFerias,
  });
}

function normalizeTipoKey(t: string | null): string {
  return (t ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function readInitial(
  initialEscala: EscalaInitialValues | null | undefined
): {
  tipo: string;
  usuarioId: string;
  dataCoordenacao: string;
  dataPlantao: string;
  horario: string;
  dataInicioFerias: string;
  dataFimFerias: string;
} {
  if (!initialEscala) {
    return {
      tipo: "",
      usuarioId: "",
      dataCoordenacao: "",
      dataPlantao: "",
      horario: "",
      dataInicioFerias: "",
      dataFimFerias: "",
    };
  }
  const n = normalizeTipoKey(initialEscala.tipo);
  const di = initialEscala.data_inicio?.trim() ?? "";
  const df = initialEscala.data_fim?.trim() ?? "";
  return {
    tipo: (initialEscala.tipo ?? "").trim(),
    usuarioId: initialEscala.usuario_id,
    dataCoordenacao: n === "coordenacao" ? di : "",
    dataPlantao: n === "plantao" ? di : "",
    horario: initialEscala.horario?.trim() ?? "",
    dataInicioFerias: n === "ferias" ? di : "",
    dataFimFerias: n === "ferias" ? df : "",
  };
}

export function EscalaForm({
  variant,
  defaultDateYmd,
  initialEscala,
  usuarios: usuariosProp,
  usuariosLoading: usuariosLoadingProp,
  onSuccess,
  onDirtyChange,
  onSavingChange,
  idPrefix = "escala",
}: EscalaFormProps) {
  const editingId = initialEscala?.id ?? null;

  const externalUsuarios = usuariosProp !== undefined;
  const [usuarios, setUsuarios] = useState<EscalaUsuarioOption[]>(
    usuariosProp ?? []
  );
  const [loadingUsers, setLoadingUsers] = useState(
    externalUsuarios ? Boolean(usuariosLoadingProp) : true
  );
  const [usersError, setUsersError] = useState<string | null>(null);

  const [tipo, setTipo] = useState(() => readInitial(initialEscala).tipo);
  const [usuarioId, setUsuarioId] = useState(
    () => readInitial(initialEscala).usuarioId
  );
  const [dataCoordenacao, setDataCoordenacao] = useState(
    () => readInitial(initialEscala).dataCoordenacao
  );
  const [dataPlantao, setDataPlantao] = useState(
    () => readInitial(initialEscala).dataPlantao
  );
  const [horario, setHorario] = useState(() => readInitial(initialEscala).horario);
  const [dataInicioFerias, setDataInicioFerias] = useState(
    () => readInitial(initialEscala).dataInicioFerias
  );
  const [dataFimFerias, setDataFimFerias] = useState(
    () => readInitial(initialEscala).dataFimFerias
  );

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const baselineRef = useRef<string>(
    serialize("", "", "", "", "", "", "")
  );

  useLayoutEffect(() => {
    baselineRef.current = serialize(
      tipo,
      usuarioId,
      dataCoordenacao,
      dataPlantao,
      horario,
      dataInicioFerias,
      dataFimFerias
    );
    // Baseline inicial após hidratar estado (novo ou edição); alterações posteriores geram dirty.
  }, []);

  useEffect(() => {
    onSavingChange?.(saving || deleting);
  }, [saving, deleting, onSavingChange]);

  useEffect(() => {
    if (externalUsuarios) {
      setUsuarios(usuariosProp);
      setLoadingUsers(Boolean(usuariosLoadingProp));
      setUsersError(null);
      return;
    }
    let cancelled = false;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url?.trim() || !key?.trim()) {
      setUsersError(
        "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local."
      );
      setLoadingUsers(false);
      return;
    }
    setLoadingUsers(true);
    setUsersError(null);
    const supabase = createBrowserClient();
    void (async () => {
      const { data, error: qErr } = await supabase
        .from("usuarios")
        .select("id, nome")
        .order("nome", { ascending: true });
      if (cancelled) return;
      setLoadingUsers(false);
      if (qErr) {
        setUsersError(qErr.message || "Não foi possível carregar os repórteres.");
        setUsuarios([]);
        return;
      }
      setUsuarios((data as EscalaUsuarioOption[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [usuariosProp, usuariosLoadingProp, externalUsuarios]);

  const applyDefaultDatesForTipo = useCallback(
    (t: string) => {
      if (!defaultDateYmd?.trim()) return;
      const d = defaultDateYmd.trim();
      if (t === ESCALA_TIPO_COORDENACAO) setDataCoordenacao(d);
      if (t === ESCALA_TIPO_PLANTAO) setDataPlantao(d);
      if (t === ESCALA_TIPO_FERIAS) {
        setDataInicioFerias(d);
        setDataFimFerias(d);
      }
    },
    [defaultDateYmd]
  );

  const resetTipoFields = useCallback(() => {
    setDataCoordenacao("");
    setDataPlantao("");
    setHorario("");
    setDataInicioFerias("");
    setDataFimFerias("");
  }, []);

  useEffect(() => {
    if (!onDirtyChange) return;
    const cur = serialize(
      tipo,
      usuarioId,
      dataCoordenacao,
      dataPlantao,
      horario,
      dataInicioFerias,
      dataFimFerias
    );
    onDirtyChange(cur !== baselineRef.current);
  }, [
    tipo,
    usuarioId,
    dataCoordenacao,
    dataPlantao,
    horario,
    dataInicioFerias,
    dataFimFerias,
    onDirtyChange,
  ]);

  const handleTipoChange = (v: string) => {
    setTipo(v);
    resetTipoFields();
    if (
      v === ESCALA_TIPO_COORDENACAO ||
      v === ESCALA_TIPO_PLANTAO ||
      v === ESCALA_TIPO_FERIAS
    ) {
      applyDefaultDatesForTipo(v);
    }
  };

  const handleDelete = useCallback(async () => {
    if (!editingId) return;
    if (!window.confirm("Tem certeza que deseja excluir esta entrada?")) return;
    setDeleting(true);
    setFormError(null);
    const res = await deleteEscala(editingId);
    setDeleting(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    onDirtyChange?.(false);
    onSuccess?.();
  }, [editingId, onSuccess, onDirtyChange]);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFormError(null);

      if (!tipo) {
        setFormError("Selecione o tipo.");
        return;
      }
      if (!usuarioId.trim()) {
        setFormError("Selecione um repórter.");
        return;
      }

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url?.trim() || !key?.trim()) {
        setFormError("Configure as variáveis de ambiente do Supabase.");
        return;
      }

      if (tipo === ESCALA_TIPO_COORDENACAO) {
        if (!dataCoordenacao.trim()) {
          setFormError("Informe a data.");
          return;
        }
      } else if (tipo === ESCALA_TIPO_PLANTAO) {
        if (!dataPlantao.trim()) {
          setFormError("Informe a data do plantão.");
          return;
        }
      } else if (tipo === ESCALA_TIPO_FERIAS) {
        if (!dataInicioFerias.trim() || !dataFimFerias.trim()) {
          setFormError("Informe a data inicial e a data final das férias.");
          return;
        }
        if (dataFimFerias < dataInicioFerias) {
          setFormError("A data final das férias não pode ser anterior à inicial.");
          return;
        }
      }

      setSaving(true);
      const supabase = createBrowserClient();

      const baseNulls = {
        coordenador: null as string | null,
      };

      let row: Record<string, unknown>;
      if (tipo === ESCALA_TIPO_COORDENACAO) {
        row = {
          tipo: ESCALA_TIPO_COORDENACAO,
          usuario_id: usuarioId.trim(),
          data_inicio: dataCoordenacao.trim(),
          data_fim: null,
          ...baseNulls,
          horario: null,
        };
      } else if (tipo === ESCALA_TIPO_PLANTAO) {
        row = {
          tipo: ESCALA_TIPO_PLANTAO,
          usuario_id: usuarioId.trim(),
          data_inicio: dataPlantao.trim(),
          data_fim: null,
          ...baseNulls,
          horario: horario.trim() || null,
        };
      } else {
        row = {
          tipo: ESCALA_TIPO_FERIAS,
          usuario_id: usuarioId.trim(),
          data_inicio: dataInicioFerias.trim(),
          data_fim: dataFimFerias.trim(),
          ...baseNulls,
          horario: null,
        };
      }

      const writeErr = editingId
        ? (
            await supabase.from("escalas").update(row).eq("id", editingId)
          ).error
        : (await supabase.from("escalas").insert(row)).error;
      setSaving(false);

      if (writeErr) {
        setFormError(
          writeErr.message ||
            "Não foi possível salvar. Verifique se a tabela escalas existe e as políticas RLS."
        );
        return;
      }

      baselineRef.current = serialize(
        tipo,
        usuarioId,
        dataCoordenacao,
        dataPlantao,
        horario,
        dataInicioFerias,
        dataFimFerias
      );
      onDirtyChange?.(false);
      onSuccess?.();
    },
    [
      editingId,
      tipo,
      usuarioId,
      dataCoordenacao,
      dataPlantao,
      horario,
      dataInicioFerias,
      dataFimFerias,
      onSuccess,
      onDirtyChange,
    ]
  );

  const disableSubmit =
    saving ||
    deleting ||
    !tipo ||
    loadingUsers ||
    usuarios.length === 0;

  const formDisabled = saving || deleting;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
    >
      {formError && (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {formError}
        </p>
      )}

      <div>
        <label
          htmlFor={`${idPrefix}-tipo`}
          className="block text-sm font-medium text-slate-700"
        >
          Tipo
        </label>
        <select
          id={`${idPrefix}-tipo`}
          value={tipo}
          onChange={(e) => handleTipoChange(e.target.value)}
          disabled={formDisabled}
          required
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50 disabled:opacity-70"
        >
          <option value="">Selecione…</option>
          <option value={ESCALA_TIPO_COORDENACAO}>{ESCALA_TIPO_COORDENACAO}</option>
          <option value={ESCALA_TIPO_PLANTAO}>{ESCALA_TIPO_PLANTAO}</option>
          <option value={ESCALA_TIPO_FERIAS}>{ESCALA_TIPO_FERIAS}</option>
        </select>
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-usuario`}
          className="block text-sm font-medium text-slate-700"
        >
          Repórter
        </label>
        {loadingUsers && (
          <p className="mt-1 text-xs text-slate-500">Carregando…</p>
        )}
        {usersError && !loadingUsers && (
          <p className="mt-1 text-xs text-red-700">{usersError}</p>
        )}
        <select
          id={`${idPrefix}-usuario`}
          value={usuarioId}
          onChange={(e) => setUsuarioId(e.target.value)}
          disabled={formDisabled || loadingUsers || usuarios.length === 0}
          required
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70"
        >
          <option value="">Selecione…</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome?.trim() || "Sem nome"}
            </option>
          ))}
        </select>
      </div>

      {tipo === ESCALA_TIPO_COORDENACAO && (
        <div>
          <label
            htmlFor={`${idPrefix}-data-coord`}
            className="block text-sm font-medium text-slate-700"
          >
            Data
          </label>
          <input
            id={`${idPrefix}-data-coord`}
            type="date"
            value={dataCoordenacao}
            onChange={(e) => setDataCoordenacao(e.target.value)}
            disabled={formDisabled}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50 disabled:opacity-70"
          />
        </div>
      )}

      {tipo === ESCALA_TIPO_PLANTAO && (
        <>
          <div>
            <label
              htmlFor={`${idPrefix}-data-plantao`}
              className="block text-sm font-medium text-slate-700"
            >
              Data
            </label>
            <input
              id={`${idPrefix}-data-plantao`}
              type="date"
              value={dataPlantao}
              onChange={(e) => setDataPlantao(e.target.value)}
              disabled={formDisabled}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50 disabled:opacity-70"
            />
          </div>
          <div>
            <label
              htmlFor={`${idPrefix}-horario`}
              className="block text-sm font-medium text-slate-700"
            >
              Horário{" "}
              <span className="font-normal text-slate-500">(opcional)</span>
            </label>
            <input
              id={`${idPrefix}-horario`}
              type="text"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              disabled={formDisabled}
              placeholder="Ex.: 08h–18h"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50 disabled:opacity-70"
            />
          </div>
        </>
      )}

      {tipo === ESCALA_TIPO_FERIAS && (
        <>
          <div>
            <label
              htmlFor={`${idPrefix}-ini-ferias`}
              className="block text-sm font-medium text-slate-700"
            >
              Data inicial
            </label>
            <input
              id={`${idPrefix}-ini-ferias`}
              type="date"
              value={dataInicioFerias}
              onChange={(e) => setDataInicioFerias(e.target.value)}
              disabled={formDisabled}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50 disabled:opacity-70"
            />
          </div>
          <div>
            <label
              htmlFor={`${idPrefix}-fim-ferias`}
              className="block text-sm font-medium text-slate-700"
            >
              Data final
            </label>
            <input
              id={`${idPrefix}-fim-ferias`}
              type="date"
              value={dataFimFerias}
              onChange={(e) => setDataFimFerias(e.target.value)}
              disabled={formDisabled}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50 disabled:opacity-70"
            />
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div className="flex min-h-[2.25rem] items-center">
          {editingId && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={formDisabled}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? "Excluindo…" : "Excluir"}
            </button>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {variant === "page" && (
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              Cancelar
            </Link>
          )}
          <button
            type="submit"
            disabled={disableSubmit}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </form>
  );
}
