import { Card, CardHeader } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";

export function CollectionPerformance({
  className,
  collected,
  interestPending,
  changePct,
  periodLabel,
}: {
  className?: string;
  /** Period-scoped (matches periodLabel, e.g. "Last 30 Days"). */
  collected: number;
  /** NOT period-scoped — portfolio-wide interest pending right now, as of
   * today. Shown alongside `collected` for a rough sense of scale, but
   * deliberately NOT summed into one misleading "period total" — the two
   * numbers cover different questions ("what came in recently" vs "what's
   * still owed overall") and labeling them as one period figure would be
   * mixing a flow with a stock. */
  interestPending: number;
  changePct: number | null;
  periodLabel: string;
}) {
  const totalDue = collected + interestPending;
  const pct = totalDue > 0 ? Math.min(100, (collected / totalDue) * 100) : collected > 0 ? 100 : 0;
  const positive = changePct != null && changePct > 0.05;

  return (
    <Card className={className}>
      <CardHeader title="Collection Performance" sub={`${periodLabel} collections vs. interest pending today`} />
      <div className="p-4 sm:p-[22px] pt-3">
        <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <div>
            <div className="text-[12.5px] text-text-secondary font-medium">Collected ({periodLabel})</div>
            <div className="text-[26px] font-extrabold tracking-tight mono-nums">{formatCurrency(collected)}</div>
          </div>
          <div className="text-right">
            <div className="text-[12.5px] text-text-secondary font-medium">Interest Pending (today)</div>
            <div className="text-[16px] font-bold tracking-tight mono-nums text-text-secondary">{formatCurrency(interestPending)}</div>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-surface-3 overflow-hidden">
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-[13px] font-bold text-success-dark dark:text-emerald-400">{pct.toFixed(0)}% collected</span>
          {changePct != null ? (
            <span className={cn("text-[12.5px] font-semibold", positive ? "text-success-dark dark:text-emerald-400" : "text-danger dark:text-red-400")}>
              {positive ? "+" : ""}
              {changePct.toFixed(1)}% vs previous period
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
