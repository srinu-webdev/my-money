import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "@/components/ui/icons";
import type { IconComponent } from "@/components/ui/icons";
import { Sparkline } from "@/components/ui/Sparkline";
import { cn } from "@/lib/cn";

type Tone = "primary" | "success" | "danger" | "warning" | "info" | "purple";

const TONE_TEXT: Record<Tone, string> = {
  primary: "text-primary-600 dark:text-indigo-300",
  success: "text-success-dark dark:text-emerald-400",
  danger: "text-danger dark:text-red-400",
  warning: "text-warning-dark dark:text-amber-400",
  info: "text-info-dark dark:text-sky-400",
  purple: "text-purple",
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  changePct,
  changeLabel,
  hint,
  trend,
  menu,
}: {
  label: string;
  value: string;
  icon: IconComponent;
  tone?: Tone;
  /** null when there's no honest baseline to compare against (e.g. a brand-new metric) — renders as neutral, not a fabricated 0%. */
  changePct?: number | null;
  changeLabel?: string;
  /** Shown instead of a change badge for point-in-time (not period) metrics, where "vs last month" isn't a meaningful comparison. */
  hint?: string;
  trend?: number[];
  menu?: ReactNode;
}) {
  const positive = changePct != null && changePct > 0.05;
  const negative = changePct != null && changePct < -0.05;

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-card-sm hover:shadow-card-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[12.5px] text-text-secondary font-medium">{label}</div>
        <div className="flex items-center gap-1 shrink-0">
          <Icon className={cn("w-[18px] h-[18px]", TONE_TEXT[tone])} />
          {menu}
        </div>
      </div>
      <div className="text-[26px] sm:text-[28px] font-extrabold mt-1.5 tracking-tight mono-nums">{value}</div>
      <div className="flex items-end justify-between gap-3 mt-2">
        <div className="min-w-0">
          {changePct != null ? (
            <div className={cn("inline-flex items-center gap-1 text-[12.5px] font-semibold", positive ? "text-success-dark dark:text-emerald-400" : negative ? "text-danger dark:text-red-400" : "text-text-secondary")}>
              {positive ? <TrendingUp className="w-3.5 h-3.5" /> : negative ? <TrendingDown className="w-3.5 h-3.5" /> : null}
              {positive ? "+" : ""}
              {changePct.toFixed(1)}%
              {changeLabel ? <span className="text-text-tertiary font-normal">&nbsp;{changeLabel}</span> : null}
            </div>
          ) : hint ? (
            <div className="text-[12px] text-text-tertiary">{hint}</div>
          ) : changeLabel ? (
            <div className="text-[12px] text-text-tertiary">No activity in the previous period to compare</div>
          ) : null}
        </div>
        {trend && trend.length >= 2 ? <Sparkline data={trend} tone={tone} /> : null}
      </div>
    </div>
  );
}
