import { Suspense } from "react";
import { getAllCustomers, getAllLoansWithBalance, getAllPayments, getCurrentAdmin, getDashboardData, getRecentActivities } from "@/lib/queries";
import { getLastNMonths, monthlyAggregate } from "@/lib/chart-utils";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { WelcomeToast } from "@/components/dashboard/WelcomeToast";
import { formatCurrency } from "@/lib/format";
import { businessHour, businessNow, formatDate } from "@/lib/dates";
import { Wallet, CreditCard, Percent, Clock, Wallet as WalletIcon, TrendingUp, Calendar, AlertTriangle } from "lucide-react";

export const metadata = { title: "Dashboard — LendPro" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, admin, activities, loans, payments, customers] = await Promise.all([
    getDashboardData(),
    getCurrentAdmin(),
    getRecentActivities(8),
    getAllLoansWithBalance(),
    getAllPayments(),
    getAllCustomers(),
  ]);

  const hour = businessHour();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = admin?.name.split(" ")[0] ?? "Admin";

  const months8 = getLastNMonths(8);
  const activeLoans = loans.filter((l) => l.status !== "CANCELLED");
  const moneyLent = monthlyAggregate(activeLoans, (l) => l.startDate, (l) => l.principal, months8);
  const collections = monthlyAggregate(payments, (p) => p.paymentDate, (p) => p.amount, months8);
  const interestCollected = monthlyAggregate(payments, (p) => p.paymentDate, (p) => p.interestAmount, months8);
  const statusCounts = { ACTIVE: 0, PARTIALLY_PAID: 0, PAID: 0, OVERDUE: 0 } as Record<string, number>;
  for (const l of activeLoans) if (l.derivedStatus in statusCounts) statusCounts[l.derivedStatus]++;
  const months6 = getLastNMonths(6);
  const customerGrowth = monthlyAggregate(customers, (c) => c.createdAt, () => 1, months6);

  return (
    <div>
      <Suspense fallback={null}>
        <WelcomeToast />
      </Suspense>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{greeting}, {firstName} 👋</h1>
          <p className="text-text-secondary text-[13.5px] mt-0.5">Here is what is happening in your lending business today.</p>
        </div>
        <QuickActions showTopButtons />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Total Money Lent" value={formatCurrency(stats.totalMoneyLent)} icon={Wallet} tone="primary" hint={`${stats.activeLoans} active · ${stats.paidLoans} paid loans`} />
        <StatCard label="Principal Outstanding" value={formatCurrency(stats.principalOutstanding)} icon={CreditCard} tone="purple" hint="Capital still with borrowers" />
        <StatCard label="Interest Earned" value={formatCurrency(stats.interestEarned)} icon={Percent} tone="success" hint="Accrued to date on all loans" />
        <StatCard label="Interest Pending" value={formatCurrency(stats.interestPending)} icon={Clock} tone="warning" hint="Accrued but not yet collected" />
        <StatCard label="Total Collected" value={formatCurrency(stats.totalCollected)} icon={WalletIcon} tone="success" hint={`${payments.length} payments recorded`} />
        <StatCard label="Today's Collection" value={formatCurrency(stats.todaysCollection)} icon={TrendingUp} tone="info" hint={formatDate(businessNow())} />
        <StatCard label="Upcoming Due" value={formatCurrency(stats.upcomingDue)} icon={Calendar} tone="warning" hint="Due within the next 7 days" />
        <StatCard label="Overdue Amount" value={formatCurrency(stats.overdueAmount)} icon={AlertTriangle} tone="danger" hint={`${stats.overdueLoans} overdue loan${stats.overdueLoans === 1 ? "" : "s"}`} />
      </div>

      <DashboardCharts
        months8Labels={months8.map((m) => m.label)}
        moneyLent={moneyLent}
        collections={collections}
        interestCollected={interestCollected}
        statusLabels={["Active", "Partially Paid", "Paid", "Overdue"]}
        statusData={[statusCounts.ACTIVE, statusCounts.PARTIALLY_PAID, statusCounts.PAID, statusCounts.OVERDUE]}
        months6Labels={months6.map((m) => m.label)}
        customerGrowth={customerGrowth}
      />

      <div className="grid lg:grid-cols-[1fr_360px] gap-5 mt-5 items-start">
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
