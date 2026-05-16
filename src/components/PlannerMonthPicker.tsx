"use client";

import { useEffect, useRef, useState } from "react";

type PlannerMonthPickerProps = {
  year: number;
  monthIndex: number;
  yearMin: number;
  yearMax: number;
  onCommit: (year: number, monthIndex: number) => void;
};

export function PlannerMonthPicker({
  year,
  monthIndex,
  yearMin,
  yearMax,
  onCommit,
}: PlannerMonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(year);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setViewYear(year);
  }, [open, year]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open]);

  const triggerLabel =
    new Date(year, monthIndex, 1)
      .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      .replace(/^\w/, (c) => c.toUpperCase());

  const monthLabels = Array.from({ length: 12 }, (_, mi) =>
    new Date(2000, mi, 1).toLocaleDateString("pt-BR", { month: "short" })
  );

  const canPrevYear = viewYear > yearMin;
  const canNextYear = viewYear < yearMax;

  return (
    <div
      ref={rootRef}
      className="relative flex min-w-0 flex-1 justify-center sm:max-w-md"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Abrir calendário para escolher mês e ano"
        className="flex w-full min-w-[min(100%,19rem)] cursor-pointer items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold capitalize text-slate-900 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span className="truncate">{triggerLabel}</span>
        <span className="shrink-0 text-slate-400" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Calendário — escolher mês"
          className="absolute left-1/2 top-[calc(100%+0.35rem)] z-50 w-[min(100vw-1.5rem,18rem)] -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
        >
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <button
              type="button"
              disabled={!canPrevYear}
              onClick={() => canPrevYear && setViewYear((y) => y - 1)}
              className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Ano anterior"
            >
              ‹
            </button>
            <span className="min-w-[4rem] text-center text-sm font-semibold text-slate-900">
              {viewYear}
            </span>
            <button
              type="button"
              disabled={!canNextYear}
              onClick={() => canNextYear && setViewYear((y) => y + 1)}
              className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Próximo ano"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {monthLabels.map((name, mi) => {
              const selected = viewYear === year && mi === monthIndex;
              return (
                <button
                  key={mi}
                  type="button"
                  onClick={() => {
                    onCommit(viewYear, mi);
                    setOpen(false);
                  }}
                  className={`rounded-md px-2 py-2 text-center text-[13px] font-medium capitalize transition ${
                    selected
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-50 text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {name.replace(/\.$/, "")}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
