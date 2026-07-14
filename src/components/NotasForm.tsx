"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { deleteNotaAction, saveNotaAction } from "@/app/actions/escalas";
import {
  ESCALA_TIPO_NOTAS,
  NOTA_TEXTO_MAX_LENGTH,
} from "@/lib/escala-constants";

export type NotasInitialValues = {
  id: string;
  texto: string | null;
};

export type NotasFormProps = {
  defaultDateYmd: string;
  initialNota?: NotasInitialValues | null;
  onSuccess?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
  idPrefix?: string;
};

function serialize(texto: string) {
  return JSON.stringify({ texto });
}

export function NotasForm({
  defaultDateYmd,
  initialNota,
  onSuccess,
  onDirtyChange,
  onSavingChange,
  idPrefix = "notas",
}: NotasFormProps) {
  const editingId = initialNota?.id ?? null;

  const [texto, setTexto] = useState(() => initialNota?.texto?.trim() ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const baselineRef = useRef<string>(serialize(""));

  useLayoutEffect(() => {
    baselineRef.current = serialize(texto);
    // Baseline só no mount (form remonta via `key` ao trocar edição).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only baseline
  }, []);

  useEffect(() => {
    onSavingChange?.(saving || deleting);
  }, [saving, deleting, onSavingChange]);

  useEffect(() => {
    if (!onDirtyChange) return;
    onDirtyChange(serialize(texto) !== baselineRef.current);
  }, [texto, onDirtyChange]);

  const handleDelete = useCallback(async () => {
    if (!editingId) return;
    if (!window.confirm("Tem certeza que deseja excluir esta nota?")) return;
    setDeleting(true);
    setFormError(null);
    const res = await deleteNotaAction(editingId);
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

      const body = texto.trim();
      const dateYmd = defaultDateYmd.trim();

      if (!body) {
        setFormError("Escreva o texto da nota.");
        return;
      }
      if (body.length > NOTA_TEXTO_MAX_LENGTH) {
        setFormError(
          `A nota pode ter no máximo ${NOTA_TEXTO_MAX_LENGTH} caracteres.`
        );
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
        setFormError("Data inválida.");
        return;
      }

      setSaving(true);
      const res = await saveNotaAction(editingId, {
        data_inicio: dateYmd,
        texto: body,
      });
      setSaving(false);

      if (!res.ok) {
        setFormError(res.error);
        return;
      }

      baselineRef.current = serialize(body);
      onDirtyChange?.(false);
      onSuccess?.();
    },
    [editingId, texto, defaultDateYmd, onSuccess, onDirtyChange]
  );

  const formDisabled = saving || deleting;
  const disableSubmit = formDisabled || !texto.trim();

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

      <p className="text-sm text-slate-600">
        Esta nota é privada — só você pode vê-la e editá-la.
      </p>

      <div>
        <label
          htmlFor={`${idPrefix}-texto`}
          className="block text-sm font-medium text-slate-700"
        >
          Nota
        </label>
        <textarea
          id={`${idPrefix}-texto`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={formDisabled}
          required
          rows={5}
          maxLength={NOTA_TEXTO_MAX_LENGTH}
          className="mt-1 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70"
          placeholder="Anotações pessoais sobre este dia…"
        />
        <p className="mt-1 text-xs text-slate-500">
          {texto.trim().length}/{NOTA_TEXTO_MAX_LENGTH}
        </p>
      </div>

      <input type="hidden" name="tipo" value={ESCALA_TIPO_NOTAS} />

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
