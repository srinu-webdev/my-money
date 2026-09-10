import { Card, CardHeader } from "@/components/ui/Card";
import { MultiLineChart } from "@/components/charts/Charts";

export function PortfolioPerformance({
  className,
  labels,
  moneyDisbursed,
  collections,
  interestCollected,
}: {
  className?: string;
  labels: string[];
  moneyDisbursed: number[];
  collections: number[];
  interestCollected: number[];
}) {
  const hasData = moneyDisbursed.some((v) => v > 0) || collections.some((v) => v > 0) || interestCollected.some((v) => v > 0);

  return (
    <Card className={className}>
      <CardHeader title="Portfolio Performance" sub="Money disbursed, collections and interest — by month" />
      <div className="p-4 h-[320px]">
        {hasData ? (
          <MultiLineChart
            labels={labels}
            series={[
              { label: "Money Disbursed", data: moneyDisbursed, color: "primary" },
              { label: "Collections", data: collections, color: "success" },
              { label: "Interest Collected", data: interestCollected, color: "purple" },
            ]}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-text-tertiary text-sm">No activity yet in this window.</div>
        )}
      </div>
    </Card>
  );
}
