/** Ícone “?” com texto longo em tooltip nativo (mouseover / foco). */
export function HelpHint({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`inline-flex h-[18px] w-[18px] shrink-0 cursor-help items-center justify-center rounded-full border border-slate-400/80 bg-white text-[11px] font-semibold leading-none text-slate-600 shadow-sm hover:border-slate-500 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${className ?? ""}`}
    >
      ?
    </button>
  );
}
