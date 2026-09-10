import { Suspense } from "react";
import { getAllCustomers, getAllDisbursements, getAllLoansWithBalance, getAllPayments, getCurrentAdmin, getDashboardData, getRecentActivities } from "@/lib/queries";
import { getLastNMonths, monthlyAggregate } from "@/lib/chart-utils";
import { computeReport, pctChange, previousPeriodRange, reportRange, type ReportRangeKey } from "@/lib/reports";
import { effectiveDisbursements } from "@/lib/calculations";
import { Card, CardHeader } from "@/components/ui/Card";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { WelcomeToast } from "@/components/dashboard/WelcomeToast";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PortfolioPerformance } from "@/components/dashboard/PortfolioPerformance";
import { LoanPortfolio } from "@/components/dashboard/LoanPortfolio";
import { CollectionPerformance } from "@/components/dashboard/CollectionPerformance";
import { ActionRequired } from "@/components/dashboard/ActionRequired";
import { CustomerGrowth } from "@/components/dashboard/CustomerGrowth";
import { CashFlow } from "@/components/dashboard/CashFlow";
import { RecentTransactions, type TransactionRow } from "@/components/dashboard/RecentTransactions";
import { formatCurrency } from "@/lib/format";
import { businessHour } from "@/lib/dates";
import { HandCoins, Wallet, CreditCard } from "@/components/ui/icons";

export const metadata = { title: "Dashboard — LendPro" };
export const dynamic = "force-dynamic";

const VALID_RANGES: ReportRangeKey[] = ["7d", "30d", "this-month", "last-month", "this-year", "all"];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const sp = await searchParams;
  const rangeKey: ReportRangeKey = VALID_RANGES.includes(sp.range as ReportRangeKey) ? (sp.range as ReportRangeKey) : "30d";

  const [stats, admin, activities, loans, payments, customers, disbursements] = await Promise.all([
    getDashboardData(),
    getCurrentAdmin(),
    getRecentActivities(8),
    getAllLoansWithBalance(),
    getAllPayments(),
    getAllCustomers(),
    getAllDisbursements(),
  ]);

  const hour = businessHour();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = admin?.name.split(" ")[0] ?? "Admin";

  // Period-scoped numbers (Money Disbursed, Total Collected, Collection
  // Performance, Cash Flow, Customer Growth's "new this period") all reuse
  // the same computeReport() the Reports page already relies on — real,
  // already-tested logic, not a second calculation path. Total
  // Portfolio/Outstanding Amount stay as point-in-time snapshots (a "vs
  // last month" comparison doesn't mean the same thing for a stock figure
  // as it does for a period flow, so they get an honest "as of today" hint
  // instead of a fabricated percentage).
  const range = reportRange(rangeKey);
  const prevRange = previousPeriodRange(range);
  const rep = computeReport(loans, payments, customers, range, disbursements);
  const prevRep = computeReport(loans, payments, customers, prevRange, disbursements);
  const lentChange = pctChange(rep.lent, prevRep.lent);
  const collectedChange = pctChange(rep.totalCollected, prevRep.totalCollected);
  const newCustomersChange = pctChange(rep.newCustomers, prevRep.newCustomers);

  const months8 = getLastNMonths(8);
  const months8Labels = months8.map((m) => m.label);
  const activeLoans = loans.filter((l) => l.status !== "CANCELLED");
  const moneyDisbursed = monthlyAggregate(activeLoans, (l) => l.startDate, (l) => l.principal, months8);
  const collections = monthlyAggregate(payments, (p) => p.paymentDate, (p) => p.amount, months8);
  const interestCollected = monthlyAggregate(payments, (p) => p.paymentDate, (p) => p.interestAmount, months8);
  // The chart bars intentionally show the same 8-month trend window as
  // Portfolio Performance — but the headline "Net {period}" figure next to
  // it must match the SAME period the label and the %-change are actually
  // computed from (the selected date-range, e.g. Last 30 Days), not the
  // sum of however many months happen to be in the chart. Summing the
  // chart's own bars here was the bug: it silently reported an 8-month
  // total under a "Last 30 Days" label.
  const cashFlowSeries = months8.map((_, i) => collections[i] - moneyDisbursed[i]);
  const netCashFlow = rep.totalCollected - rep.lent;
  const cashFlowChange = pctChange(netCashFlow, prevRep.totalCollected - prevRep.lent);

  const statusCounts = { ACTIVE: 0, PARTIALLY_PAID: 0, PAID: 0, OVERDUE: 0 } as Record<string, number>;
  for (const l of activeLoans) if (l.derivedStatus in statusCounts) statusCounts[l.derivedStatus]++;

  const months6 = getLastNMonths(6);
  const customerGrowthSeries = monthlyAggregate(customers, (c) => c.createdAt, () => 1, months6);

  const totalPortfolioValue = stats.principalOutstanding + stats.interestPending;

  const customerNames = new Map(customers.map((c) => [c.id, c.name]));
  const loanMeta = new Map(loans.map((l) => [l.id, { customerId: l.customerId, status: l.derivedStatus }]));
  // Most loans in this app have no explicit Disbursement rows at all — the
  // full principal was handed over in one go on the start date, and that's
  // tracked implicitly (see effectiveDisbursements, the same fallback the
  // interest engine itself uses). Reading `disbursements` directly here
  // would silently show a "Recent Transactions" feed with zero disbursal
  // events for those loans, even though real money clearly went out —
  // wrong by omission. Group the real rows per loan first, then let
  // effectiveDisbursements fill in the implicit one where there are none.
  const disbursementsByLoan = new Map<string, typeof disbursements>();
  for (const d of disbursements) {
    const arr = disbursementsByLoan.get(d.loanId) ?? [];
    arr.push(d);
    disbursementsByLoan.set(d.loanId, arr);
  }
  const disbursalEvents = loans.flatMap((l) =>
    effectiveDisbursements(l, disbursementsByLoan.get(l.id)).map((d, i) => ({
      id: `dis-${l.id}-${i}-${d.date}`,
      date: d.date,
      customerId: l.customerId,
      customerName: customerNames.get(l.customerId) ?? "—",
      loanId: l.id,
      type: "Loan Disbursal" as const,
      amount: d.amount,
      loanStatus: l.derivedStatus,
      reference: l.id,
    }))
  );
  const transactions: TransactionRow[] = [
    ...payments.map((p) => {
      const meta = loanMeta.get(p.loanId);
      return {
        id: `pay-${p.id}`,
        date: p.paymentDate,
        customerId: p.customerId,
        customerName: customerNames.get(p.customerId) ?? "—",
        loanId: p.loanId,
        type: "Payment Received" as const,
        amount: p.amount,
        loanStatus: meta?.status ?? "ACTIVE",
        reference: p.reference ?? p.id,
      };
    }),
    ...disbursalEvents,
  ]
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
    .slice(0, 10);

  const exportRows: (string | number)[][] = [
    ["Period", rep.range.label],
    ["Total Portfolio", totalPortfolioValue],
    ["Money Disbursed (period)", rep.lent],
    ["Total Collected (period)", rep.totalCollected],
    ["Outstanding Amount", totalPortfolioValue],
    ["Overdue Amount", stats.overdueAmount],
    ["Overdue Loans", stats.overdueLoans],
    ["Interest Pending", stats.interestPending],
    ["Net Cash Flow (period)", rep.totalCollected - rep.lent],
    ["New Customers (period)", rep.newCustomers],
  ];

  return (
    <div>
      <Suspense fallback={null}>
        <WelcomeToast />
      </Suspense>

      <DashboardHeader greeting={`${greeting}, ${firstName}`} rangeKey={rangeKey} rangeLabel={rep.range.label} exportRows={exportRows} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard label="Total Portfolio" value={formatCurrency(totalPortfolioValue)} icon={Wallet} tone="primary" hint="As of today" />
        <KpiCard label="Money Disbursed" value={formatCurrency(rep.lent)} icon={HandCoins} tone="info" changePct={lentChange} changeLabel="vs previous period" trend={moneyDisbursed} />
        <KpiCard label="Total Collected" value={formatCurrency(rep.totalCollected)} icon={Wallet} tone="success" changePct={collectedChange} changeLabel="vs previous period" trend={collections} />
        <KpiCard label="Outstanding Amount" value={formatCurrency(totalPortfolioValue)} icon={CreditCard} tone="warning" hint={`${stats.overdueLoans} overdue loan${stats.overdueLoans === 1 ? "" : "s"}`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5 items-stretch">
        <PortfolioPerformance className="lg:col-span-2" labels={months8Labels} moneyDisbursed={moneyDisbursed} collections={collections} interestCollected={interestCollected} />
        <LoanPortfolio
          active={statusCounts.ACTIVE}
          partiallyPaid={statusCounts.PARTIALLY_PAID}
          paid={statusCounts.PAID}
          overdue={statusCounts.OVERDUE}
          overdueAmount={stats.overdueAmount}
          totalPortfolioValue={totalPortfolioValue}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5 items-stretch">
        <CollectionPerformance collected={rep.totalCollected} interestPending={stats.interestPending} changePct={collectedChange} periodLabel={rep.range.label} />
        <ActionRequired
          overdueLoans={stats.overdueLoans}
          overdueAmount={stats.overdueAmount}
          upcomingDueLoans={stats.upcomingDueLoans}
          upcomingDue={stats.upcomingDue}
          interestPending={stats.interestPending}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5 items-stretch">
        <CustomerGrowth labels={months6.map((m) => m.label)} data={customerGrowthSeries} newThisPeriod={rep.newCustomers} changePct={newCustomersChange} periodLabel={rep.range.label} />
        <CashFlow labels={months8Labels} data={cashFlowSeries} net={netCashFlow} changePct={cashFlowChange} periodLabel={rep.range.label} />
      </div>

      <div className="mb-5">
        <RecentTransactions transactions={transactions} />
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-5 items-start">
        <Card>
          <CardHeader title="Recent Activity" sub="Latest actions across the system" actions={<a href="/notifications" className="text-primary text-sm font-semibold hover:underline">View notifications</a>} />
          <ActivityList activities={activities} />
        </Card>
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Quick Actions" />
            <div className="p-4 sm:p-[22px]">
              <QuickActions grid />
            </div>
          </Card>
        </div>
      </div>

      <p className="text-center text-[11.5px] text-text-tertiary mt-6 leading-relaxed">
        This software is a record-keeping and management tool. Interest calculations and lending practices should comply with applicable local laws and regulations.
      </p>
    </div>
  );
}
