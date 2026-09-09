import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateLoanBalance, nextMonthlyCollectionDate } from "@/lib/calculations";
import { serializeLoan, serializePayment, serializeDisbursement } from "@/lib/serialize";
import { formatDate } from "@/lib/dates";

// Vercel Cron (see vercel.json) hits this once a day. For every active
// monthly-interest loan, checks whether its next recurring collection day
// (the day-of-month it started on) is exactly 2 days away, and raises an
// in-app notification if so — "two days before, notification should come."
// Skips loans already fully settled and avoids re-raising the same
// reminder if the cron somehow runs more than once for the same due date.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const loanRows = await prisma.loan.findMany({
    where: { status: { not: "CANCELLED" }, interestFrequency: "MONTHLY", repaymentType: { not: "Daily Installment" } },
    include: { customer: true },
  });

  const created: string[] = [];
  for (const loanRow of loanRows) {
    const loan = serializeLoan(loanRow);
    const { date: nextDue, daysUntil } = nextMonthlyCollectionDate(loan.startDate);
    if (daysUntil !== 2) continue;

    const [paymentRows, disbursementRows] = await Promise.all([
      prisma.payment.findMany({ where: { loanId: loanRow.id } }),
      prisma.disbursement.findMany({ where: { loanId: loanRow.id } }),
    ]);
    const bal = calculateLoanBalance(loan, paymentRows.map(serializePayment), undefined, disbursementRows.map(serializeDisbursement));
    if (bal.totalOutstanding <= 1) continue; // fully settled — nothing to remind about

    const message = `Interest for ${loanRow.id} (${loanRow.customer.name}) is due on ${formatDate(nextDue)} — 2 days from now`;
    const dupe = await prisma.notification.findFirst({
      where: { type: "due", message, createdAt: { gte: new Date(Date.now() - 3 * 86400000) } },
    });
    if (dupe) continue;

    await prisma.notification.create({ data: { type: "due", message } });
    created.push(loanRow.id);
  }

  return NextResponse.json({ checked: loanRows.length, created });
}
