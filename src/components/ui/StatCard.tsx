import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "primary" | "success" | "warning" | "danger" | "info" | "purple";

const TONE_CLASSES: Record<Tone, string> = {
  primary: "bg-primary-50 text-primary-600 dark:text-indigo-300",
  success: "bg-success-light text-success-dark dark:text-emerald-400",
  warning: "bg-warning-light text-warning-dark dark:text-amber-400",
  danger: "bg-danger-light text-danger dark:text-red-400",
  info: "bg-info-light text-info-dark dark:text-sky-400",
  purple: "bg-purple/10 text-purple dark:bg-purple/20",
};

export function StatCard({ label, value, icon: Icon, tone = "primary", hint }: { label: string; value: string | number; icon: LucideIcon; tone?: Tone; hint?: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-card-sm hover:shadow-card-md hover:-translate-y-0.5 transition-all duration-200">
      <div className={cn("w-[42px] h-[42px] rounded-xl flex items-center justify-center mb-3.5", TONE_CLASSES[tone])}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-[12.5px] text-text-secondary font-medium">{label}</div>
      <div className="text-[22px] font-extrabold mt-1 tracking-tight mono-nums">{value}</div>
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
