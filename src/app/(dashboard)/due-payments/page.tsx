import { getAllCustomers, getAllLoansWithBalance } from "@/lib/queries";
import { addDays, parseDate, todayStr, toISODate } from "@/lib/dates";
import { DuePaymentsSections, type DueItem } from "@/components/loans/DuePaymentsSections";
import type { MonthlyDueItem } from "@/components/loans/MonthlyCollectionSection";

export const metadata = { title: "Due Payments — LendPro" };
export const dynamic = "force-dynamic";

// The day-of-month a loan started on doubles as its recurring monthly
// collection day (a loan given on the 10th is collected on the 10th every
// month after) — this finds the NEXT occurrence of that day from today,
// clamping to the last day of a shorter month (e.g. a "31st" loan is
// collected on the 28th/29th in February).
function nextCollectionDay(startDateIso: string, t0: Date): { dueDay: number; daysUntil: number } {
  const start = parseDate(startDateIso);
  const dueDay = start.getDate();
  const y = t0.getFullYear();
  const m = t0.getMonth();
  const clampedThisMonth = Math.min(dueDay, new Date(y, m + 1, 0).getDate());
  let candidate = new Date(y, m, clampedThisMonth);
  if (candidate < t0) {
    const clampedNextMonth = Math.min(dueDay, new Date(y, m + 2, 0).getDate());
    candidate = new Date(y, m + 1, clampedNextMonth);
  }
  const daysUntil = Math.round((candidate.getTime() - t0.getTime()) / 86400000);
  return { dueDay, daysUntil };
}

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
      const { dueDay, daysUntil } = nextCollectionDay(loan.startDate, t0);
      if (loan.balance.interestPendingWhole > 0.01 || (daysUntil >= 0 && daysUntil <= 5)) {
        monthlyItems.push({ loan, dueDay, daysUntil });
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
