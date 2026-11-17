"use client";

import { TIPOS_MULTIMIDIA, type TipoMultimidia } from "@/lib/pautas-shared";

type MultimidiaFieldProps = {
  idPrefix: string;
  checked: boolean;
  selected: readonly TipoMultimidia[];
  onCheckedChange: (checked: boolean) => void;
  onSelectedChange: (selected: TipoMultimidia[]) => void;
  disabled?: boolean;
};

export function MultimidiaField({
  idPrefix,
  checked,
  selected,
  onCheckedChange,
  onSelectedChange,
  disabled = false,
}: MultimidiaFieldProps) {
  const toggleTipo = (tipo: TipoMultimidia, next: boolean) => {
    if (next) {
      if (selected.includes(tipo)) return;
      onSelectedChange(
        TIPOS_MULTIMIDIA.filter((item) => item === tipo || selected.includes(item))
      );
      return;
    }
    onSelectedChange(selected.filter((item) => item !== tipo));
  };

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="sr-only">Multimídia</legend>
      <label
        htmlFor={`${idPrefix}-multimidia`}
        className="flex items-center gap-2 text-sm font-medium text-slate-700"
      >
        <input
          id={`${idPrefix}-multimidia`}
          name="demanda_multimidia"
          type="checkbox"
          checked={checked}
          onChange={(ev) => onCheckedChange(ev.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 disabled:cursor-not-allowed"
        />
        Multimídia
      </label>
      {checked ? (
        <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-xs text-slate-500">
            Marque um ou mais formatos para esta pauta.
          </p>
          {TIPOS_MULTIMIDIA.map((tipo) => {
            const inputId = `${idPrefix}-tipo-${tipo.replace(/\s+/g, "-").toLowerCase()}`;
            return (
              <label
                key={tipo}
                htmlFor={inputId}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <input
                  id={inputId}
                  name="tipos_multimidia"
                  type="checkbox"
                  value={tipo}
                  checked={selected.includes(tipo)}
                  onChange={(ev) => toggleTipo(tipo, ev.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 disabled:cursor-not-allowed"
                />
                {tipo}
              </label>
            );
          })}
        </div>
      ) : null}
    </fieldset>
  );
}
