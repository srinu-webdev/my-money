import { getAllCustomers, getAllPayments, getDashboardData } from "@/lib/queries";
import { getLastNMonths, monthlyAggregate } from "@/lib/chart-utils";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { MoneyBarChart, MoneyLineChart } from "@/components/charts/Charts";
import { PaymentsTable, ExportPaymentsButton } from "@/components/payments/PaymentsTable";
import { formatCurrency } from "@/lib/format";
import { Percent, CheckCircle2, Clock, TrendingUp, Wallet } from "lucide-react";

export const metadata = { title: "Revenue — LendPro" };
export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const [payments, customers, stats] = await Promise.all([getAllPayments(), getAllCustomers(), getDashboardData()]);
  const names = new Map(customers.map((c) => [c.id, c.name]));
  const months = getLastNMonths(12);
  const interestSeries = monthlyAggregate(payments, (p) => p.paymentDate, (p) => p.interestAmount, months);
  const collectionSeries = monthlyAggregate(payments, (p) => p.paymentDate, (p) => p.amount, months);
  const principalCollected = payments.reduce((s, p) => s + p.principalAmount, 0);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Revenue</h1>
          <p className="text-text-secondary text-[13.5px] mt-0.5">Interest income and total collections.</p>
        </div>
        <ExportPaymentsButton payments={payments} customerNames={names} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <StatCard label="Total Interest Earned" value={formatCurrency(stats.interestEarned)} icon={Percent} tone="primary" hint="Accrued to date" />
        <StatCard label="Interest Collected" value={formatCurrency(stats.interestEarned - stats.interestPending)} icon={CheckCircle2} tone="success" />
        <StatCard label="Interest Pending" value={formatCurrency(stats.interestPending)} icon={Clock} tone="warning" />
        <StatCard label="Principal Collected" value={formatCurrency(principalCollected)} icon={TrendingUp} tone="info" />
        <StatCard label="Total Collections" value={formatCurrency(stats.totalCollected)} icon={Wallet} tone="purple" />
      </div>
      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <Card>
          <CardHeader title="Monthly Interest" sub="Interest collected per month" />
          <div className="p-4 h-[260px]">
            <MoneyBarChart labels={months.map((m) => m.label)} data={interestSeries} color="purple" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Monthly Collections" sub="Total collected per month" />
          <div className="p-4 h-[260px]">
            <MoneyLineChart labels={months.map((m) => m.label)} data={collectionSeries} color="success" />
          </div>
        </Card>
      </div>
      <PaymentsTable payments={payments} customerNames={names} />
    </div>
  );
}
