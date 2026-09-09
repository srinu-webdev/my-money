import { getAllCustomers, getAllLoansWithBalance } from "@/lib/queries";
import { addDays, todayStr, toISODate } from "@/lib/dates";
import { nextMonthlyCollectionDate } from "@/lib/calculations";
import { DuePaymentsSections, type DueItem } from "@/components/loans/DuePaymentsSections";
import type { MonthlyDueItem } from "@/components/loans/MonthlyCollectionSection";

export const metadata = { title: "Due Payments — LendPro" };
export const dynamic = "force-dynamic";

export default async function DuePaymentsPage() {
  const [loans, customersList] = await Promise.all([getAllLoansWithBalance(), getAllCustomers()]);
  const customers = new Map(customersList.map((c) => [c.id, c]));

  const today = todayStr();
  const tomorrow = toISODate(addDays(new Date(), 1));
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);

  const todayItems: DueItem[] = [];
  const tomorrowItems: DueItem[] = [];
  const upcomingItems: DueItem[] = [];
  const monthlyItems: MonthlyDueItem[] = [];

  for (const loan of loans) {
    if (loan.derivedStatus === "PAID" || loan.derivedStatus === "CANCELLED") continue;
    if (loan.interestFrequency === "MONTHLY" && loan.repaymentType !== "Daily Installment") {
      const { date: nextDueDate, daysUntil } = nextMonthlyCollectionDate(loan.startDate, t0, loan.collectionDay);
      if (loan.balance.interestPendingWhole > 0.01 || (daysUntil >= 0 && daysUntil <= 5)) {
        monthlyItems.push({ loan, nextDueDate, daysUntil });
      }
    }
    if (loan.balance.totalOutstanding <= 0) continue;
    const due = new Date(loan.dueDate);
    if (due < t0) continue;
    const days = Math.round((due.getTime() - t0.getTime()) / 86400000);
    const label = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days} days`;
    if (loan.dueDate === today) todayItems.push({ loan, label });
    else if (loan.dueDate === tomorrow) tomorrowItems.push({ loan, label });
    else if (days <= 30) upcomingItems.push({ loan, label });
  }
  upcomingItems.sort((a, b) => a.loan.dueDate.localeCompare(b.loan.dueDate));

  return <DuePaymentsSections today={todayItems} tomorrow={tomorrowItems} upcoming={upcomingItems} monthly={monthlyItems} customers={customers} />;
}
