import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { calculateLoanBalance, dailyInstallmentPlan, nextMonthlyCollectionDate } from "@/lib/calculations";
import { serializeLoan, serializePayment, serializeDisbursement } from "@/lib/serialize";
import { formatCurrency } from "@/lib/format";
import { businessNow, formatDate, todayStr } from "@/lib/dates";

// Vercel Cron (see vercel.json) hits this once a day. For every active
// monthly-interest loan, raises an in-app notification at three points:
// 5 days before the next recurring collection day, on the day itself, and
// the day after (if still unpaid) — matching the business's reminder
// policy. Skips loans already fully settled. Each tier's message text is
// deterministic for that loan+day, and is checked against recent
// notifications before creating one, so a cron retry (or running twice in
// a day) never raises the same reminder twice.
const REMINDER_DAYS_BEFORE = 5;

async function notifyOnce(message: string) {
  const dupe = await prisma.notification.findFirst({
    where: { type: "due", message, createdAt: { gte: new Date(Date.now() - 3 * 86400000) } },
  });
  if (dupe) return false;
  await prisma.notification.create({ data: { type: "due", message } });
  return true;
}

export async function GET(request: Request) {
  // Fails CLOSED, not open: a misconfigured/missing CRON_SECRET must never
  // silently turn this into a public, unauthenticated endpoint — it was
  // previously skipped entirely when the env var was unset.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }
  const authHeader = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  const authorized = authHeader.length === expected.length && timingSafeEqual(authHeader, expected);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loanRows = await prisma.loan.findMany({
    where: { status: { not: "CANCELLED" }, interestFrequency: "MONTHLY", repaymentType: { not: "Daily Installment" } },
    include: { customer: true },
  });

  const created: string[] = [];
  for (const loanRow of loanRows) {
    const loan = serializeLoan(loanRow);
    const { date: nextDue, daysUntil } = nextMonthlyCollectionDate(loan.startDate, undefined, loan.collectionDay);

    const [paymentRows, disbursementRows] = await Promise.all([
      prisma.payment.findMany({ where: { loanId: loanRow.id } }),
      prisma.disbursement.findMany({ where: { loanId: loanRow.id } }),
    ]);
    const bal = calculateLoanBalance(loan, paymentRows.map(serializePayment), undefined, disbursementRows.map(serializeDisbursement));
    if (bal.totalOutstanding <= 1) continue; // fully settled — nothing to remind about

    const who = `${loanRow.id} (${loanRow.customer.name})`;
    let message: string | null = null;
    if (daysUntil === REMINDER_DAYS_BEFORE) {
      message = `Interest payment of ${formatCurrency(bal.interestPerPeriod)} for ${who} is due in ${REMINDER_DAYS_BEFORE} days, on ${formatDate(nextDue)}.`;
    } else if (daysUntil === 0) {
      message = `Interest payment of ${formatCurrency(bal.interestPerPeriod)} for ${who} is due today.`;
    } else if (bal.daysOverdue === 1) {
      // Fires once, the day after a cycle's due date passes unpaid — not
      // every day it stays overdue, so a long-overdue loan doesn't spam a
      // fresh notification daily.
      message = `Interest payment of ${formatCurrency(bal.interestPendingWhole)} for ${who} is overdue.`;
    }
    if (message && (await notifyOnce(message))) created.push(loanRow.id);
  }

  // Daily Installment loans: one "today's payment requirement" reminder
  // per loan per day. The message embeds today's date, so — unlike the
  // monthly tiers above, which are each keyed to a single specific day —
  // an unchanged required amount two days running still produces two
  // distinct (correctly non-duplicate) messages, while a retry within the
  // same day matches the existing notification and is skipped.
  const dailyLoanRows = await prisma.loan.findMany({
    where: { status: { not: "CANCELLED" }, repaymentType: "Daily Installment" },
    include: { customer: true },
  });
  const today = todayStr();
  for (const loanRow of dailyLoanRows) {
    const loan = serializeLoan(loanRow);
    const [paymentRows, disbursementRows] = await Promise.all([
      prisma.payment.findMany({ where: { loanId: loanRow.id } }),
      prisma.disbursement.findMany({ where: { loanId: loanRow.id } }),
    ]);
    const payments = paymentRows.map(serializePayment);
    const disbursements = disbursementRows.map(serializeDisbursement);
    const bal = calculateLoanBalance(loan, payments, undefined, disbursements);
    if (bal.totalOutstanding <= 1) continue; // fully settled

    const plan = dailyInstallmentPlan(loan, bal.totalPaid, businessNow(), disbursements);
    if (!plan || plan.remainingAmount <= 0.01) continue;

    const who = `${loanRow.id} (${loanRow.customer.name})`;
    const message =
      plan.catchUpAmount > 0.01
        ? `Daily installment for ${who} — ${formatDate(today)}: missed payment(s) detected, ${formatCurrency(plan.catchUpAmount)} catch-up needed (≈${plan.missedDays} day${plan.missedDays === 1 ? "" : "s"}). Today's required payment: ${formatCurrency(plan.requiredDailyNow)}.`
        : `Daily installment for ${who} — ${formatDate(today)}: today's required payment is ${formatCurrency(plan.requiredDailyNow)} (${formatCurrency(plan.remainingAmount)} remaining over ${plan.remainingDays} day${plan.remainingDays === 1 ? "" : "s"}).`;
    if (await notifyOnce(message)) created.push(loanRow.id);
  }

  return NextResponse.json({ checked: loanRows.length + dailyLoanRows.length, created });
}
