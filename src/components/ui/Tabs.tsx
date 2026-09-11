import { cn } from "@/lib/cn";

export interface TabItem {
  key: string;
  label: string;
  /** Visually de-emphasize this tab — used for a filter bucket that
   * currently matches nothing, so the eye isn't drawn to it over tabs with
   * real counts. Still clickable; never applied while it's the active tab,
   * so selecting an empty filter doesn't look broken. */
  muted?: boolean;
}

// Deliberately not "use client": these are pure, controlled components —
// the parent (always a Client Component, since it owns the active-tab
// state) supplies `onChange`, so no hooks are needed here.

export function Tabs({ tabs, active, onChange }: { tabs: TabItem[]; active: string; onChange: (key: string) => void }) {
  return (
    <div
      className="flex gap-1 border-b border-border px-[22px] overflow-x-auto"
      // A row of 5-6 tabs doesn't fit a phone width, so this scrolls — but
      // with no visual cue, a partially-scrolled strip just looks like a
      // cut-off layout bug (as it was mistaken for). A permanent edge
      // fade is the standard, JS-free way to signal "there's more here."
      style={{ maskImage: "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)" }}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "px-3.5 py-3 font-semibold text-[13.5px] border-b-2 -mb-px whitespace-nowrap transition-colors",
            active === t.key ? "text-primary border-primary" : "text-text-secondary border-transparent hover:text-text"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function PillTabs({ tabs, active, onChange }: { tabs: TabItem[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="inline-flex gap-1 bg-surface-3 p-1 rounded-[10px] flex-wrap">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all",
            active === t.key ? "bg-surface text-text shadow-card-sm" : t.muted ? "text-text-tertiary hover:text-text-secondary" : "text-text-secondary hover:text-text"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
