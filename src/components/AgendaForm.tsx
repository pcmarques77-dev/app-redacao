"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { deleteAgendaAction, saveAgendaAction } from "@/app/actions/escalas";
import {
  AGENDA_TITULO_MAX_LENGTH,
  ESCALA_TIPO_AGENDA,
} from "@/lib/escala-constants";
import { EDITORIA_OPTIONS } from "@/lib/pauta-form-options";

export type AgendaInitialValues = {
  id: string;
  titulo: string | null;
  editoria: string | null;
};

export type AgendaFormProps = {
  defaultDateYmd: string;
  initialAgenda?: AgendaInitialValues | null;
  editoriaOptions?: string[];
  onSuccess?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
  idPrefix?: string;
};

function serialize(titulo: string, editoria: string) {
  return JSON.stringify({ titulo, editoria });
}

export function AgendaForm({
  defaultDateYmd,
  initialAgenda,
  editoriaOptions = EDITORIA_OPTIONS,
  onSuccess,
  onDirtyChange,
  onSavingChange,
  idPrefix = "agenda",
}: AgendaFormProps) {
  const editingId = initialAgenda?.id ?? null;

  const [titulo, setTitulo] = useState(
    () => initialAgenda?.titulo?.trim() ?? ""
  );
  const [editoria, setEditoria] = useState(() => {
    const stored = initialAgenda?.editoria?.trim();
    if (stored && editoriaOptions.includes(stored)) return stored;
    return editoriaOptions[0] ?? "Últimas Notícias";
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const baselineRef = useRef<string>(serialize("", ""));

  useLayoutEffect(() => {
    baselineRef.current = serialize(titulo, editoria);
    // Baseline só no mount (form remonta via `key` ao trocar edição).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only baseline
  }, []);

  useEffect(() => {
    onSavingChange?.(saving || deleting);
  }, [saving, deleting, onSavingChange]);

  useEffect(() => {
    if (!onDirtyChange) return;
    onDirtyChange(serialize(titulo, editoria) !== baselineRef.current);
  }, [titulo, editoria, onDirtyChange]);

  const handleDelete = useCallback(async () => {
    if (!editingId) return;
    if (!window.confirm("Tem certeza que deseja excluir este evento da agenda?")) {
      return;
    }
    setDeleting(true);
    setFormError(null);
    const res = await deleteAgendaAction(editingId);
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

      const tituloTrim = titulo.trim();
      const editoriaTrim = editoria.trim();
      const dateYmd = defaultDateYmd.trim();

      if (!tituloTrim) {
        setFormError("Informe o título.");
        return;
      }
      if (tituloTrim.length > AGENDA_TITULO_MAX_LENGTH) {
        setFormError(
          `O título pode ter no máximo ${AGENDA_TITULO_MAX_LENGTH} caracteres.`
        );
        return;
      }
      if (!editoriaTrim) {
        setFormError("Selecione a editoria.");
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
        setFormError("Data inválida.");
        return;
      }

      setSaving(true);
      const res = await saveAgendaAction(editingId, {
        data_inicio: dateYmd,
        titulo: tituloTrim,
        editoria: editoriaTrim,
      });
      setSaving(false);

      if (!res.ok) {
        setFormError(res.error);
        return;
      }

      baselineRef.current = serialize(tituloTrim, editoriaTrim);
      onDirtyChange?.(false);
      onSuccess?.();
    },
    [editingId, titulo, editoria, defaultDateYmd, onSuccess, onDirtyChange]
  );

  const formDisabled = saving || deleting;
  const disableSubmit = formDisabled || !titulo.trim() || !editoria.trim();

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
          htmlFor={`${idPrefix}-titulo`}
          className="block text-sm font-medium text-slate-700"
        >
          Título
        </label>
        <input
          id={`${idPrefix}-titulo`}
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          disabled={formDisabled}
          required
          maxLength={AGENDA_TITULO_MAX_LENGTH}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70"
          placeholder="Nome do evento"
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-editoria`}
          className="block text-sm font-medium text-slate-700"
        >
          Editoria
        </label>
        <select
          id={`${idPrefix}-editoria`}
          value={editoria}
          onChange={(e) => setEditoria(e.target.value)}
          disabled={formDisabled}
          required
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-[10px] text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70"
        >
          {editoriaOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      <input type="hidden" name="tipo" value={ESCALA_TIPO_AGENDA} />

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
