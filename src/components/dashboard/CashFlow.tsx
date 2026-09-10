import { Card, CardHeader } from "@/components/ui/Card";
import { CashFlowBarChart } from "@/components/charts/Charts";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";

export function CashFlow({
  className,
  labels,
  data,
  net,
  changePct,
  periodLabel,
}: {
  className?: string;
  labels: string[];
  data: number[];
  net: number;
  changePct: number | null;
  periodLabel: string;
}) {
  const positive = net >= 0;
  const trendPositive = changePct != null && changePct > 0.05;
  const hasData = data.some((v) => v !== 0);

  return (
    <Card className={className}>
      <CardHeader
        title="Cash Flow"
        sub={
          <span className="inline-flex items-baseline gap-1.5 flex-wrap">
            Net {periodLabel}:{" "}
            <b className={cn("font-bold", positive ? "text-success-dark dark:text-emerald-400" : "text-danger dark:text-red-400")}>
              {positive ? "+" : "−"}
              {formatCurrency(Math.abs(net))}
            </b>
            {changePct != null ? (
              <span className={cn("font-semibold", trendPositive ? "text-success-dark dark:text-emerald-400" : "text-danger dark:text-red-400")}>
                ({trendPositive ? "+" : ""}
                {changePct.toFixed(1)}% vs previous period)
              </span>
            ) : null}
          </span>
        }
      />
      <div className="p-4 h-[220px]">{hasData ? <CashFlowBarChart labels={labels} data={data} /> : <div className="h-full flex items-center justify-center text-text-tertiary text-sm">No cash movement in this window.</div>}</div>
    </Card>
  );
}
