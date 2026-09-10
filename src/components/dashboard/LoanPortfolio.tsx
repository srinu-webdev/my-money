import { Card, CardHeader } from "@/components/ui/Card";
import { LoanStatusDoughnut } from "@/components/charts/Charts";
import { formatCurrency } from "@/lib/format";

export function LoanPortfolio({
  className,
  active,
  partiallyPaid,
  paid,
  overdue,
  overdueAmount,
  totalPortfolioValue,
}: {
  className?: string;
  active: number;
  partiallyPaid: number;
  paid: number;
  overdue: number;
  overdueAmount: number;
  totalPortfolioValue: number;
}) {
  const total = active + partiallyPaid + paid + overdue;
  const overduePct = totalPortfolioValue > 0 ? (overdueAmount / totalPortfolioValue) * 100 : 0;

  return (
    <Card className={className}>
      <CardHeader title="Loan Portfolio" sub="Status breakdown across all loans" />
      <div className="p-4">
        {total > 0 ? (
          <div className="relative h-[200px]">
            <LoanStatusDoughnut labels={["Active", "Partially Paid", "Paid", "Overdue"]} data={[active, partiallyPaid, paid, overdue]} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ right: "38%" }}>
              <div className="text-[22px] font-extrabold tracking-tight mono-nums">{total.toLocaleString("en-IN")}</div>
              <div className="text-[11px] text-text-tertiary font-medium">Total Loans</div>
            </div>
          </div>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-text-tertiary text-sm">No loans yet.</div>
        )}
        <div className="border-t border-border -mx-4 sm:-mx-[22px] mt-1 pt-4 px-4 sm:px-[22px]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12.5px] text-text-secondary font-medium">Overdue Amount</div>
              <div className="text-[19px] font-extrabold tracking-tight text-danger mono-nums mt-0.5">{formatCurrency(overdueAmount)}</div>
            </div>
            <div className="text-[12.5px] font-semibold text-danger bg-danger-light px-2.5 py-1 rounded-full">{overduePct.toFixed(1)}% of portfolio</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
