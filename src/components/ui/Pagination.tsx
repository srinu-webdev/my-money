import { cn } from "@/lib/cn";

export function Pagination({ page, totalPages, total, start, end, label = "records", onChange }: { page: number; totalPages: number; total: number; start: number; end: number; label?: string; onChange: (page: number) => void }) {
  if (!total) return null;
  const range = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const pages = [...range].sort((a, b) => a - b);
  const items: (number | "dots")[] = [];
  let last = 0;
  for (const p of pages) {
    if (p - last > 1) items.push("dots");
    items.push(p);
    last = p;
  }
  const btn = (p: number, content: React.ReactNode, activeP = false, disabled = false) => (
    <button
      key={`${content}-${p}`}
      disabled={disabled}
      onClick={() => onChange(p)}
      className={cn(
        "min-w-8 h-8 px-2 rounded-lg border text-[12.5px] font-semibold transition-all",
        activeP ? "bg-primary text-white border-primary" : "bg-surface text-text-secondary border-border hover:border-primary hover:text-primary",
        disabled && "opacity-45 pointer-events-none"
      )}
    >
      {content}
    </button>
  );
  return (
    <div className="flex items-center justify-between gap-3 px-[22px] py-3.5 flex-wrap text-[13px] text-text-secondary">
      <div>
        Showing <b className="text-text">{start}–{end}</b> of <b className="text-text">{total}</b> {label}
      </div>
      <div className="flex gap-1 items-center">
        {btn(page - 1, "Previous", false, page === 1)}
        {items.map((it, i) => (it === "dots" ? <span key={`dots-${i}`} className="px-1 text-text-tertiary">…</span> : btn(it, it, it === page)))}
        {btn(page + 1, "Next", false, page === totalPages)}
      </div>
    </div>
  );
}
