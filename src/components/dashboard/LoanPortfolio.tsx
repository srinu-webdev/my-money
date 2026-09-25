"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { LoanStatusDoughnut, useChartColors } from "@/components/charts/Charts";
import { formatCurrency } from "@/lib/format";

const SEGMENTS = ["Active", "Partially Paid", "Completed", "Overdue"] as const;

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
  const c = useChartColors();
  const counts = [active, partiallyPaid, paid, overdue];
  const colors = [c.primary, c.info, c.success, c.danger];

  return (
    <Card className={className}>
      <CardHeader title="Loan Portfolio" sub="Status breakdown across all loans" />
      <div className="p-4">
        {total > 0 ? (
          // The ring sits in its own square box, with nothing else sharing
          // it — the "N Total Loans" overlay can then just center on that
          // box directly (no guessed offset for a legend's width, which
          // would drift out of alignment at other screen sizes). The
          // legend itself is a plain HTML list beside it instead of
          // Chart.js's built-in one, which is what needed that guess.
          <div className="flex items-center gap-5 flex-wrap">
            <div className="relative w-[168px] h-[168px] shrink-0 mx-auto sm:mx-0">
              <LoanStatusDoughnut labels={[...SEGMENTS]} data={counts} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-[22px] font-extrabold tracking-tight mono-nums">{total.toLocaleString("en-IN")}</div>
                <div className="text-[11px] text-text-tertiary font-medium">Total Loans</div>
              </div>
            </div>
            {/* min-w-0 lets this shrink and wrap its label text within a
                narrow card instead of holding its content's full natural
                width and getting silently clipped by the card's rounded
                corners — the bug that "flex-nowrap sm:..." had at exactly
                the width where the 2-column dashboard grid is active but a
                single card is still fairly narrow. */}
            <div className="flex flex-col gap-2.5 text-[12.5px] font-medium min-w-0">
              {SEGMENTS.map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[i] }} />
                  <span className="text-text-secondary">{label}</span>
                </div>
              ))}
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
