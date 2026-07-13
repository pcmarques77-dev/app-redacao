"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  deleteStreamyardAction,
  saveStreamyardAction,
} from "@/app/actions/escalas";
import {
  ESCALA_TIPO_STREAMYARD,
  normalizeHorarioForTimeInput,
} from "@/lib/escala-constants";

export type StreamyardUsuarioOption = {
  id: string;
  nome: string | null;
};

export type StreamyardInitialValues = {
  id: string;
  usuario_id: string;
  horario: string | null;
};

export type StreamyardFormProps = {
  defaultDateYmd: string;
  initialStreamyard?: StreamyardInitialValues | null;
  usuarios?: StreamyardUsuarioOption[];
  usuariosLoading?: boolean;
  /** Editor/super admin: escolhe o jornalista; repórter: só para si. */
  canPickUsuario?: boolean;
  /** ID do usuário logado (repórter). */
  currentUserId?: string;
  onSuccess?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
  idPrefix?: string;
};

function serialize(usuarioId: string, horario: string) {
  return JSON.stringify({ usuarioId, horario });
}

export function StreamyardForm({
  defaultDateYmd,
  initialStreamyard,
  usuarios = [],
  usuariosLoading = false,
  canPickUsuario = false,
  currentUserId = "",
  onSuccess,
  onDirtyChange,
  onSavingChange,
  idPrefix = "streamyard",
}: StreamyardFormProps) {
  const editingId = initialStreamyard?.id ?? null;

  const [usuarioId, setUsuarioId] = useState(() => {
    if (initialStreamyard?.usuario_id?.trim()) {
      return initialStreamyard.usuario_id.trim();
    }
    if (!canPickUsuario && currentUserId.trim()) {
      return currentUserId.trim();
    }
    return "";
  });
  const [horario, setHorario] = useState(() =>
    normalizeHorarioForTimeInput(initialStreamyard?.horario)
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const baselineRef = useRef<string>(serialize("", ""));

  useLayoutEffect(() => {
    baselineRef.current = serialize(usuarioId, horario);
    // Baseline só no mount (form remonta via `key` ao trocar edição).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only baseline
  }, []);

  useEffect(() => {
    if (!canPickUsuario && currentUserId.trim()) {
      setUsuarioId(currentUserId.trim());
    }
  }, [canPickUsuario, currentUserId]);

  useEffect(() => {
    onSavingChange?.(saving || deleting);
  }, [saving, deleting, onSavingChange]);

  useEffect(() => {
    if (!onDirtyChange) return;
    onDirtyChange(serialize(usuarioId, horario) !== baselineRef.current);
  }, [usuarioId, horario, onDirtyChange]);

  const handleDelete = useCallback(async () => {
    if (!editingId) return;
    if (!window.confirm("Tem certeza que deseja excluir esta marcação?")) return;
    setDeleting(true);
    setFormError(null);
    const res = await deleteStreamyardAction(editingId);
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

      const uid = usuarioId.trim();
      const hor = horario.trim();
      const dateYmd = defaultDateYmd.trim();

      if (!uid) {
        setFormError("Selecione um jornalista.");
        return;
      }
      if (!hor) {
        setFormError("Informe o horário.");
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
        setFormError("Data inválida.");
        return;
      }

      setSaving(true);
      const res = await saveStreamyardAction(editingId, {
        usuario_id: uid,
        data_inicio: dateYmd,
        horario: hor,
      });
      setSaving(false);

      if (!res.ok) {
        setFormError(res.error);
        return;
      }

      baselineRef.current = serialize(uid, hor);
      onDirtyChange?.(false);
      onSuccess?.();
    },
    [editingId, usuarioId, horario, defaultDateYmd, onSuccess, onDirtyChange]
  );

  const formDisabled = saving || deleting;
  const disableSubmit =
    formDisabled ||
    usuariosLoading ||
    (canPickUsuario && usuarios.length === 0) ||
    !horario.trim() ||
    !usuarioId.trim();

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

      {canPickUsuario ? (
        <div>
          <label
            htmlFor={`${idPrefix}-usuario`}
            className="block text-sm font-medium text-slate-700"
          >
            Jornalista
          </label>
          {usuariosLoading && (
            <p className="mt-1 text-xs text-slate-500" role="status">
              Carregando…
            </p>
          )}
          <select
            id={`${idPrefix}-usuario`}
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value)}
            disabled={formDisabled || usuariosLoading || usuarios.length === 0}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-[10px] text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70"
          >
            <option value="">Selecione…</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome?.trim() || "Sem nome"}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          Esta marcação será para você no Streamyard.
        </p>
      )}

      <div>
        <label
          htmlFor={`${idPrefix}-horario`}
          className="block text-sm font-medium text-slate-700"
        >
          Horário
        </label>
        <input
          id={`${idPrefix}-horario`}
          type="time"
          step={60}
          value={horario}
          onChange={(e) => setHorario(e.target.value)}
          disabled={formDisabled}
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70"
        />
      </div>

      <input type="hidden" name="tipo" value={ESCALA_TIPO_STREAMYARD} />

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        {editingId ? (
          <button
            type="button"
            disabled={formDisabled}
            onClick={() => void handleDelete()}
            className="order-2 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:order-1"
          >
            {deleting ? "Excluindo…" : "Excluir"}
          </button>
        ) : (
          <span className="order-2 hidden sm:order-1 sm:block sm:flex-1" />
        )}
        <div className="order-1 flex flex-wrap justify-end gap-2 sm:order-2 sm:ml-auto">
          <button
            type="submit"
            disabled={disableSubmit}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </form>
  );
}
