import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@/components/ui/icons";
import { getActivitiesFor, getCustomerById, getDisbursementsByLoan, getLoanById, getPaymentsByLoan } from "@/lib/queries";
import { calculateLoanBalance, dailyInstallmentPlan, getLoanSchedule, getLoanStatus, monthlyInterestSchedule, nextMonthlyCollectionDate, pendingInterestCaption, FREQ_LABEL, FREQ_NOUN } from "@/lib/calculations";
import { CalendarClock } from "@/components/ui/icons";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/format";
import { businessNow, formatDate, formatDateTime, parseDate } from "@/lib/dates";
import { Wallet, Percent, CheckCircle, Clock, TrendingUp, CreditCard, AlertTriangle, Info, HandCoins } from "@/components/ui/icons";
import { LoanDetailTabs } from "@/components/loans/LoanDetailTabs";
import { LoanDetailActions } from "@/components/loans/LoanDetailActions";
import { AddDisbursementButton, DisbursementHistoryRow } from "@/components/loans/DisbursementFormModal";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `${id} — LendPro` };
}

export default async function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loan = await getLoanById(id);
  if (!loan) notFound();

  const [payments, disbursements, customer, activities] = await Promise.all([
    getPaymentsByLoan(id),
    getDisbursementsByLoan(id),
    getCustomerById(loan.customerId),
    getActivitiesFor({ loanId: id }, 40),
  ]);
  const balance = calculateLoanBalance(loan, payments, undefined, disbursements);
  const status = getLoanStatus(loan, balance);
  const schedule = getLoanSchedule(loan, payments, undefined, disbursements);
  const paidPct = loan.principal ? Math.min(100, Math.round((balance.principalPaid / loan.principal) * 100)) : 0;
  const rateLabel = loan.interestType === "FIXED" ? `${formatCurrency(loan.interestRate)} / ${FREQ_NOUN[loan.interestFrequency]}` : `${loan.interestRate}% ${FREQ_LABEL[loan.interestFrequency]}`;

  // Daily Installment plan — shared with the daily reminder notification
  // (src/app/api/cron/due-reminders/route.ts) so both always agree.
  const dailyPlan = dailyInstallmentPlan(loan, balance.totalPaid, businessNow(), disbursements);

  // Per-cycle monthly interest schedule (Interest Only / Principal +
  // Interest, MONTHLY frequency only — returns [] otherwise): each
  // recurring obligation shown individually as PAID/OVERDUE/DUE/UPCOMING,
  // rather than just one lump total, so a multi-month arrears situation
  // ("October overdue, November overdue, December due") is visible
  // month-by-month, not just as a single combined number.
  const monthlySchedule = monthlyInterestSchedule(loan, businessNow(), payments, disbursements, 3);
  const monthLabel = (iso: string) => new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(parseDate(iso));
  const SCHEDULE_TONE = { PAID: "success", OVERDUE: "danger", DUE: "warning", UPCOMING: "gray" } as const;

  return (
    <div>
      <div className="text-[12.5px] text-text-tertiary mb-2 flex items-center gap-1.5">
        <Link href="/loans" className="text-primary font-medium hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Loans
        </Link>
        <span>›</span>
        <span>{loan.id}</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-extrabold tracking-tight font-mono">{loan.id}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="text-text-secondary text-[13.5px] mt-0.5">
            Customer:{" "}
            <Link href={`/customers/${loan.customerId}`} className="text-primary font-semibold hover:underline">
              {customer?.name ?? "Unknown"}
            </Link>{" "}
            · {customer?.phone} · Created {formatDate(loan.createdAt)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-start">
          <AddDisbursementButton loan={loan} pending={balance.pendingDisbursement} />
          <LoanDetailActions loan={loan} paymentsCount={balance.paymentsCount} status={status} />
        </div>
      </div>

      {balance.pendingDisbursement > 0 && (
        <div className="flex gap-2.5 bg-info-light text-info-dark dark:text-sky-300 rounded-[10px] px-4 py-3 text-[13px] mb-5">
          <HandCoins className="w-[18px] h-[18px] shrink-0 mt-0.5" />
          <span>
            <strong>{formatCurrency(balance.totalDisbursed)} disbursed so far</strong> of the {formatCurrency(loan.principal)} agreed amount — {formatCurrency(balance.pendingDisbursement)} is still pending. Interest only accrues on money actually handed over, so it&rsquo;s not counted as outstanding yet.
          </span>
        </div>
      )}

      {status === "OVERDUE" && (
        <div className="flex gap-2.5 bg-danger-light text-danger-dark dark:text-red-300 rounded-[10px] px-4 py-3 text-[13px] mb-5">
          <AlertTriangle className="w-[18px] h-[18px] shrink-0 mt-0.5" />
          <span>
            <strong>Overdue by {balance.daysOverdue} day{balance.daysOverdue === 1 ? "" : "s"}.</strong> Due date was {formatDate(balance.daysOverdueSince)}. Outstanding {formatCurrency(balance.totalOutstanding)}.
          </span>
        </div>
      )}
      {status === "CANCELLED" && (
        <div className="flex gap-2.5 bg-warning-light text-warning-dark dark:text-amber-300 rounded-[10px] px-4 py-3 text-[13px] mb-5">
          <Info className="w-[18px] h-[18px] shrink-0 mt-0.5" />
          <span>
            <strong>This loan is cancelled{loan.cancelledAt ? ` since ${formatDate(loan.cancelledAt)}` : ""}.</strong> Interest stopped accruing and it is excluded from outstanding totals.
          </span>
        </div>
      )}

      {dailyPlan && (
        <div className="flex gap-2.5 bg-primary-50 text-primary-700 dark:text-indigo-300 rounded-[10px] px-4 py-3 text-[13px] mb-3">
          <CalendarClock className="w-[18px] h-[18px] shrink-0 mt-0.5" />
          <span>
            <strong>Daily Installment plan: collect {formatCurrency(dailyPlan.dailyAmount)} every day</strong> from {formatDate(loan.startDate)} to {formatDate(loan.dueDate)} ({dailyPlan.totalDays} days) to close this loan on time —{" "}
            {formatCurrency(loan.principal)} principal + {formatCurrency(dailyPlan.totalPayable - loan.principal)} interest = {formatCurrency(dailyPlan.totalPayable)} total, spread evenly.
          </span>
        </div>
      )}
      {dailyPlan && status !== "PAID" && status !== "CANCELLED" && (
        <div className={`flex gap-2.5 rounded-[10px] px-4 py-3 text-[13px] mb-5 ${dailyPlan.catchUpAmount > 0 ? "bg-danger-light text-danger-dark dark:text-red-300" : "bg-success-light text-success-dark dark:text-emerald-300"}`}>
          {dailyPlan.catchUpAmount > 0 ? <AlertTriangle className="w-[18px] h-[18px] shrink-0 mt-0.5" /> : <CheckCircle className="w-[18px] h-[18px] shrink-0 mt-0.5" />}
          <span>
            <strong>Day {dailyPlan.daysElapsed} of {dailyPlan.totalDays}.</strong>{" "}
            {dailyPlan.catchUpAmount > 0 ? (
              <>
                Missed payments have rolled forward and stacked up —{" "}
                <strong>collect {formatCurrency(dailyPlan.catchUpAmount)} now to fully catch up</strong> (≈{dailyPlan.missedDays} missed day{dailyPlan.missedDays === 1 ? "" : "s"} of {formatCurrency(dailyPlan.dailyAmount)}, not just yesterday&rsquo;s — every earlier missed day is included). Expected {formatCurrency(dailyPlan.expectedByNow)} collected by today, actually collected {formatCurrency(balance.totalPaid)}.
              </>
            ) : (
              <>
                On track — {formatCurrency(dailyPlan.aheadOrBehind)} ahead of the day-{dailyPlan.daysElapsed} target ({formatCurrency(dailyPlan.expectedByNow)} expected, {formatCurrency(balance.totalPaid)} actually collected).
              </>
            )}{" "}
            {dailyPlan.daysElapsed > 0 && (
              <>
                At this pace, projected collection by {formatDate(loan.dueDate)} is <strong>{formatCurrency(dailyPlan.projectedTotal)}</strong>
                {dailyPlan.projectedShortfall > 0 ? (
                  <>
                    {" "}
                    — <strong>₹{Math.round(dailyPlan.projectedShortfall).toLocaleString("en-IN")} short</strong> of the {formatCurrency(dailyPlan.totalPayable)} needed to fully close this loan on time unless collections pick up.
                  </>
                ) : (
                  <> — enough to fully close this loan on time.</>
                )}
              </>
            )}
          </span>
        </div>
      )}
      {dailyPlan && status !== "PAID" && status !== "CANCELLED" && (
        <div className="flex gap-2.5 bg-surface-2 text-text-secondary rounded-[10px] px-4 py-3 text-[13px] mb-5">
          <CalendarClock className="w-[18px] h-[18px] shrink-0 mt-0.5" />
          <span>
            <strong className="text-text">Current required daily payment: {formatCurrency(dailyPlan.requiredDailyNow)}</strong> — recalculated fresh from what&rsquo;s actually left, not the fixed day-one rate above. Remaining amount {formatCurrency(dailyPlan.remainingAmount)} ÷ {dailyPlan.remainingDays} day{dailyPlan.remainingDays === 1 ? "" : "s"} left until {formatDate(loan.dueDate)}.
          </span>
        </div>
      )}

      {monthlySchedule.length > 0 && (
        <Card className="mb-5">
          <div className="px-4 sm:px-[22px] py-[18px] border-b border-border">
            <h3 className="text-[15px] font-bold">Monthly Interest Schedule</h3>
            <div className="text-[12.5px] text-text-secondary mt-0.5">Each recurring monthly interest cycle, tracked individually — a later month never hides an earlier one still owed.</div>
          </div>
          <div className="p-4 sm:p-[22px] flex flex-col gap-2.5">
            {monthlySchedule.map((cycle) => (
              <div key={cycle.end} className="flex items-center justify-between gap-3 text-[13.5px]">
                <span className="font-medium">{monthLabel(cycle.end)}</span>
                <span className="flex items-center gap-3">
                  <span className="mono-nums font-semibold">{formatCurrency(cycle.amount)}</span>
                  <Badge tone={SCHEDULE_TONE[cycle.status]}>{cycle.status}</Badge>
                </span>
              </div>
            ))}
            {monthlySchedule.some((c) => c.status === "OVERDUE" || c.status === "DUE") && (
              <div className="text-[12.5px] text-text-secondary pt-2 mt-1 border-t border-border">
                Total unpaid interest:{" "}
                <strong className="text-text">
                  {formatCurrency(monthlySchedule.filter((c) => c.status === "OVERDUE" || c.status === "DUE").reduce((s, c) => s + c.amount, 0))}
                </strong>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard
          label="Agreed Principal"
          value={formatCurrency(balance.principal)}
          icon={Wallet}
          tone="primary"
          hint={balance.pendingDisbursement > 0 ? `${formatCurrency(balance.totalDisbursed)} disbursed · ${rateLabel}` : rateLabel}
        />
        <StatCard label="Interest Accrued" value={formatCurrency(balance.interestAccrued)} icon={Percent} tone="purple" hint={`${formatCurrency(balance.interestPerPeriod)} per period on current balance`} />
        <StatCard label="Interest Paid" value={formatCurrency(balance.interestPaid)} icon={CheckCircle} tone="success" />
        <StatCard
          label="Interest Remaining"
          value={formatCurrency(balance.interestRemaining)}
          icon={Clock}
          tone={balance.interestRemaining > 0 ? "warning" : "success"}
          hint={
            pendingInterestCaption(status, balance)
              ? `${pendingInterestCaption(status, balance)} (${formatCurrency(balance.interestPendingWhole)}), ${balance.interestPerPeriod <= 0 ? "principal already repaid" : "rest still accruing"}`
              : balance.interestPendingWholeRaw > 0.01
                ? // A just-completed period is unpaid but still inside its grace
                  // window — say so plainly rather than "Next due" next month,
                  // which would hide that this period itself hasn't been paid.
                  `${formatCurrency(balance.interestPendingWholeRaw)} due since ${formatDate(balance.currentPeriodStart)}`
                : balance.interestRemaining > 0.01 && loan.interestFrequency === "MONTHLY"
                  ? `Next due ${formatDate(nextMonthlyCollectionDate(loan.startDate, undefined, loan.collectionDay).date)}`
                  : undefined
          }
        />
        <StatCard label="Principal Paid" value={formatCurrency(balance.principalPaid)} icon={TrendingUp} tone="success" hint={`${paidPct}% repaid`} />
        <StatCard label="Principal Remaining" value={formatCurrency(balance.principalRemaining)} icon={CreditCard} tone="info" />
        <StatCard label="Total Paid" value={formatCurrency(balance.totalPaid)} icon={Wallet} tone="success" hint={`${balance.paymentsCount} payment${balance.paymentsCount === 1 ? "" : "s"}`} />
        <StatCard
          label="Total Outstanding"
          value={formatCurrency(balance.totalOutstanding)}
          icon={AlertTriangle}
          tone={balance.totalOutstanding > 0 ? "danger" : "success"}
          hint={balance.daysOverdue ? `${balance.daysOverdue} days overdue` : `${balance.daysActive} days active`}
        />
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-5 items-start">
        <LoanDetailTabs payments={payments} schedule={schedule} activities={activities} interestAccrued={balance.interestAccrued} />

        <div className="flex flex-col gap-5">
          <Card>
            <div className="px-4 sm:px-[22px] py-[18px] border-b border-border">
              <h3 className="text-[15px] font-bold">Loan Information</h3>
            </div>
            <div className="p-4 sm:p-[22px]">
              <div className="flex flex-col">
                {[
                  ["Loan ID", loan.id],
                  ["Amount", formatCurrency(loan.principal)],
                  ["Interest", rateLabel],
                  ["Interest Type", loan.interestType === "FIXED" ? "Fixed amount" : "Percentage"],
                  ["Frequency", FREQ_LABEL[loan.interestFrequency]],
                  ["Start Date", formatDate(loan.startDate)],
                  ["Due Date", formatDate(loan.dueDate)],
                  ["Repayment Type", loan.repaymentType],
                  ["Created", formatDateTime(loan.createdAt)],
                  ["Last Payment", balance.lastPaymentDate ? `${formatDate(balance.lastPaymentDate)} · ${formatCurrency(balance.lastPaymentAmount)}` : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 py-2.5 border-b border-border text-[13px] last:border-0">
                    <span className="text-text-secondary">{k}</span>
                    <span className={`font-semibold text-right ${k === "Due Date" && status === "OVERDUE" ? "text-danger" : ""}`}>{v}</span>
                  </div>
                ))}
              </div>
              {loan.notes ? <div className="bg-info-light text-info-dark dark:text-sky-300 rounded-[10px] px-3.5 py-2.5 text-[13px] mt-4">{loan.notes}</div> : null}
            </div>
          </Card>
          {(disbursements.length > 1 || balance.pendingDisbursement > 0) && (
            <Card>
              <div className="px-4 sm:px-[22px] py-[18px] border-b border-border flex items-center justify-between gap-2">
                <h3 className="text-[15px] font-bold">Disbursements</h3>
                <span className="text-[12px] text-text-tertiary">{formatCurrency(balance.totalDisbursed)} of {formatCurrency(loan.principal)}</span>
              </div>
              <div className="p-4 sm:p-[22px]">
                <div className="flex flex-col">
                  {disbursements.map((d) => (
                    <DisbursementHistoryRow key={d.id} d={d} />
                  ))}
                </div>
              </div>
            </Card>
          )}
          <Card>
            <div className="p-4 sm:p-[22px]">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-text-secondary">Principal repaid</span>
                <b>{paidPct}%</b>
              </div>
              <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                <div className="h-full bg-primary-600 rounded-full" style={{ width: `${paidPct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-text-tertiary mt-2">
                <span>{formatCurrency(balance.principalPaid)}</span>
                <span>{formatCurrency(balance.principalRemaining)} left</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
