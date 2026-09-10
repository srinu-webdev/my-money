import type { IconComponent } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

type Tone = "primary" | "success" | "warning" | "danger" | "info" | "purple";

const TONE_TEXT: Record<Tone, string> = {
  primary: "text-primary-600 dark:text-indigo-300",
  success: "text-success-dark dark:text-emerald-400",
  warning: "text-warning-dark dark:text-amber-400",
  danger: "text-danger dark:text-red-400",
  info: "text-info-dark dark:text-sky-400",
  purple: "text-purple",
};

export function StatCard({ label, value, icon: Icon, tone = "primary", hint }: { label: string; value: string | number; icon: IconComponent; tone?: Tone; hint?: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-card-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12.5px] text-text-secondary font-medium">{label}</div>
        <Icon className={cn("w-[22px] h-[22px] shrink-0", TONE_TEXT[tone])} />
      </div>
      <div className="text-[22px] font-extrabold mt-2 tracking-tight mono-nums">{value}</div>
      {hint ? <div className="text-[11.5px] text-text-tertiary mt-1.5">{hint}</div> : null}
    </div>
  );
}

export function MiniStat({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div className="bg-surface-2 border border-border rounded-xl px-4 py-3.5">
      <div className="text-[11.5px] text-text-secondary font-medium">{label}</div>
      <div className={cn("text-[17px] font-extrabold mt-0.5 mono-nums tracking-tight", className)}>{value}</div>
    </div>
  );
}
