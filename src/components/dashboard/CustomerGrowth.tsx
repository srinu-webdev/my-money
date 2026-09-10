import { Card, CardHeader } from "@/components/ui/Card";
import { CountBarChart } from "@/components/charts/Charts";
import { cn } from "@/lib/cn";

export function CustomerGrowth({
  className,
  labels,
  data,
  newThisPeriod,
  changePct,
  periodLabel,
}: {
  className?: string;
  labels: string[];
  data: number[];
  newThisPeriod: number;
  changePct: number | null;
  periodLabel: string;
}) {
  const positive = changePct != null && changePct > 0.05;
  const hasData = data.some((v) => v > 0);

  return (
    <Card className={className}>
      <CardHeader
        title="Customer Growth"
        sub={
          <span className="inline-flex items-baseline gap-1.5">
            <b className="text-text font-bold">{newThisPeriod}</b> new · {periodLabel}
            {changePct != null ? (
              <span className={cn("font-semibold", positive ? "text-success-dark dark:text-emerald-400" : "text-danger dark:text-red-400")}>
                ({positive ? "+" : ""}
                {changePct.toFixed(0)}% vs previous period)
              </span>
            ) : null}
          </span>
        }
      />
      <div className="p-4 h-[220px]">{hasData ? <CountBarChart labels={labels} data={data} color="info" /> : <div className="h-full flex items-center justify-center text-text-tertiary text-sm">No new customers in this window.</div>}</div>
    </Card>
  );
}
