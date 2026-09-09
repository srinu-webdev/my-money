import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import type { LoanStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/calculations";

type Tone = "success" | "warning" | "danger" | "primary" | "info" | "gray";

const TONES: Record<Tone, string> = {
  success: "bg-success-light text-success-dark dark:text-emerald-400",
  warning: "bg-warning-light text-warning-dark dark:text-amber-400",
  danger: "bg-danger-light text-danger-dark dark:text-red-400",
  primary: "bg-primary-50 text-primary-600 dark:text-indigo-300",
  info: "bg-info-light text-info-dark dark:text-sky-400",
  gray: "bg-surface-3 text-text-secondary",
};

export function Badge({ tone = "gray", plain, children, className }: { tone?: Tone; plain?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold whitespace-nowrap leading-relaxed", TONES[tone], className)}>
      {!plain && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-85" />}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<LoanStatus, Tone> = {
  ACTIVE: "primary",
  PARTIALLY_PAID: "info",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "gray",
};

export function StatusBadge({ status, className }: { status: LoanStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} className={className}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
