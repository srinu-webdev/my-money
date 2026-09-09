// =====================================================================
// INTEREST ENGINE — pure, framework-agnostic business logic.
//
// BUSINESS RULE: interest accrues on the OUTSTANDING principal, not the
// original principal. When part of the principal is repaid, every
// subsequent period is charged on the reduced balance from that
// payment's date onward — mirroring how a real lending business (and
// the customer) expects running interest to work.
//
//   • "PERCENTAGE" rate -> rate% of outstanding principal per period.
//   • "FIXED" rate      -> a flat ₹ amount per period regardless of the
//     principal balance (until the principal is fully repaid).
//   • Frequency defines the period length: daily=1d, weekly=7d,
//     monthly=30d, yearly=365d. A period is owed in full the moment ANY
//     part of it has elapsed — matching how local lending businesses
//     actually charge "monthly interest" (a flat sum due for the month,
//     not a bank-style daily-prorated fraction). Taking a ₹40,000 loan
//     at 5%/month means the full ₹2,000 is owed from day one of that
//     month, whether the borrower repays on day 2 or day 29 — it never
//     shows a fraction like ₹200 for "only 3 days in." The same rounding
//     applies to every later period and to every balance-reducing
//     segment (a partial payment still leaves at least one full period's
//     interest owed on whatever remains, never a partial-period credit).
//   • Accrual stops once the outstanding principal reaches zero, or the
//     loan is cancelled (accrual is capped at `cancelledAt`).
//   • Interest is never negative.
//
// DISBURSEMENT TRANCHES: a loan's `principal` is the AGREED total — it
// doesn't have to be handed over all at once. If a loan carries explicit
// Disbursement rows (e.g. ₹50,000 now, ₹50,000 later against a ₹1,00,000
// agreement), interest accrues on the running sum of disbursements to
// date, merged into the same chronological timeline as principal
// repayments: disbursements raise the accruing balance, repayments lower
// it. A loan with no Disbursement rows (the common case) behaves exactly
// as before — the full principal is treated as handed over on the start
// date.
// =====================================================================
import { daysBetween, parseDate, startOfDay } from "./dates";
import type {
  AllocationMode,
  CustomerSummary,
  DashboardStats,
  Disbursement,
  InterestFrequency,
  Loan,
  LoanBalance,
  LoanStatus,
  Payment,
} from "./types";

export const FREQUENCY_DAYS: Record<InterestFrequency, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
  YEARLY: 365,
};

export const FREQ_LABEL: Record<InterestFrequency, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

// The singular period noun ("every day", "per month"...). Not derived from
// FREQ_LABEL by stripping "ly" — "Daily" ends in "ily", so that trick
// wrongly yields "dai" instead of "day".
export const FREQ_NOUN: Record<InterestFrequency, string> = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
  YEARLY: "year",
};

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}
// Any elapsed time within a period counts as that whole period being
// owed — 1 day into a 30-day month is still 1 full period, 31 days in
// is 2. Zero elapsed days owes nothing (same-day, nothing has started).
function periodsOwed(days: number, periodDays: number): number {
  return days > 0 ? Math.ceil(days / periodDays) : 0;
}
function sum<T>(arr: T[], fn: (x: T) => number): number {
  return arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0);
}

type DisbursementLike = Pick<Disbursement, "date" | "amount">;
type PaymentLike = Pick<Payment, "paymentDate" | "principalAmount">;

/** Disbursement rows if any exist, otherwise a single synthesized handover of the full principal on the start date — keeps every caller that doesn't know about tranches working unchanged. */
function effectiveDisbursements(loan: Pick<Loan, "principal" | "startDate">, disbursements?: DisbursementLike[]): DisbursementLike[] {
  if (disbursements && disbursements.length) return disbursements;
  return [{ date: loan.startDate, amount: loan.principal }];
}

export function calculateInterestForLoan(
  loan: Pick<Loan, "principal" | "startDate" | "interestRate" | "interestType" | "interestFrequency" | "status" | "cancelledAt">,
  asOfDate: string | Date,
  payments: PaymentLike[],
  disbursements?: DisbursementLike[]
): number {
  let asOf = startOfDay(asOfDate);
  if (loan.status === "CANCELLED" && loan.cancelledAt) {
    const c = startOfDay(loan.cancelledAt);
    if (c < asOf) asOf = c; // accrual stops at cancellation
  }

  const rate = Number(loan.interestRate) || 0;
  const periodDays = FREQUENCY_DAYS[loan.interestFrequency] || 30;

  // One merged, chronological timeline: disbursements raise the accruing
  // balance, principal repayments lower it. A pure interest payment
  // (principalAmount 0) doesn't touch the balance, so it's excluded here —
  // otherwise it would split an ongoing period into two pieces that each
  // get independently rounded up, inflating the total (recording that an
  // interest payment was made should never itself increase how much
  // interest the loan shows as owed).
  const events = [
    ...effectiveDisbursements(loan, disbursements).map((d) => ({ date: startOfDay(d.date), delta: Number(d.amount) || 0 })),
    ...payments.filter((p) => (Number(p.principalAmount) || 0) > 0).map((p) => ({ date: startOfDay(p.paymentDate), delta: -(Number(p.principalAmount) || 0) })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const firstDate = events.length ? events[0].date : startOfDay(loan.startDate);
  if (asOf <= firstDate) return 0;

  let segStart = firstDate;
  let bal = 0;
  let interest = 0;
  // Periods are counted GLOBALLY from firstDate, never reset per segment —
  // each segment is only charged for whatever NEW whole periods its own
  // end newly crosses into (at that segment's own balance), so splitting
  // the timeline at a balance-changing event can never double-charge a
  // period that was already underway.
  let periodsCharged = 0;
  const accrueSegment = (segEnd: Date) => {
    if (segEnd <= segStart) return;
    const totalPeriods = periodsOwed(daysBetween(firstDate, segEnd), periodDays);
    const newPeriods = Math.max(0, totalPeriods - periodsCharged);
    if (newPeriods > 0 && bal > 0) {
      interest += loan.interestType === "FIXED" ? rate * newPeriods : bal * (rate / 100) * newPeriods;
    }
    periodsCharged = totalPeriods;
  };
  for (const ev of events) {
    if (ev.date <= segStart) {
      bal = Math.max(0, bal + ev.delta);
      continue;
    }
    if (ev.date >= asOf) break;
    accrueSegment(ev.date);
    bal = Math.max(0, bal + ev.delta);
    segStart = ev.date;
  }
  accrueSegment(asOf);
  return Math.max(0, round2(interest));
}

export function interestPerPeriod(
  loan: Pick<Loan, "interestRate" | "interestType">,
  principal: number
): number {
  const rate = Number(loan.interestRate) || 0;
  return loan.interestType === "FIXED" ? rate : (principal * rate) / 100;
}

export function calculateLoanBalance(loan: Loan, payments: Payment[], asOfDate?: string | Date, disbursements?: Disbursement[]): LoanBalance {
  const principal = Number(loan.principal) || 0;
  const totalDisbursed = round2(sum(effectiveDisbursements(loan, disbursements), (d) => d.amount));
  const pendingDisbursement = Math.max(0, round2(principal - totalDisbursed));
  const principalPaid = round2(sum(payments, (p) => p.principalAmount));
  const interestPaid = round2(sum(payments, (p) => p.interestAmount));
  // What's owed is measured against what's actually been handed over, not
  // the full agreed amount — money not yet disbursed isn't debt yet.
  const principalRemaining = Math.max(0, round2(totalDisbursed - principalPaid));
  const interestAccrued = calculateInterestForLoan(loan, asOfDate ?? new Date(), payments, disbursements);
  const interestRemaining = Math.max(0, round2(interestAccrued - interestPaid));
  const totalPaid = round2(principalPaid + interestPaid);
  const totalOutstanding = round2(principalRemaining + interestRemaining);
  const sorted = [...payments].sort(
    (a, b) => parseDate(b.paymentDate).getTime() - parseDate(a.paymentDate).getTime()
  );
  const today = new Date();
  const due = parseDate(loan.dueDate);
  return {
    principal,
    principalPaid,
    interestPaid,
    principalRemaining,
    interestAccrued,
    interestRemaining,
    totalPaid,
    totalOutstanding,
    paymentsCount: payments.length,
    lastPaymentDate: sorted[0]?.paymentDate ?? null,
    lastPaymentAmount: sorted[0]?.amount ?? 0,
    daysActive: Math.max(0, daysBetween(loan.startDate, today)),
    daysOverdue: due && due < startOfDay(today) && totalOutstanding > 0 ? daysBetween(due, today) : 0,
    interestPerPeriod: interestPerPeriod(loan, principalRemaining),
    totalDisbursed,
    pendingDisbursement,
  };
}

// Status is DERIVED — never trust `loan.status` alone except for the
// manual Cancelled / (fully paid) Paid states.
export function getLoanStatus(loan: Pick<Loan, "status" | "dueDate">, bal: LoanBalance): LoanStatus {
  if (loan.status === "CANCELLED") return "CANCELLED";
  if (bal.totalOutstanding <= 1) return "PAID";
  const due = parseDate(loan.dueDate);
  if (due < startOfDay(new Date())) return "OVERDUE";
  if (bal.totalPaid > 0) return "PARTIALLY_PAID";
  return "ACTIVE";
}

export const STATUS_LABEL: Record<LoanStatus, string> = {
  ACTIVE: "Active",
  PAID: "Paid",
  CANCELLED: "Cancelled",
  OVERDUE: "Overdue",
  PARTIALLY_PAID: "Partially Paid",
};

// Payment allocation waterfall.
export function computeAllocation(
  loan: Loan,
  existingPayments: Payment[],
  amount: number,
  mode: AllocationMode,
  custom?: { interestAmount?: number; principalAmount?: number },
  asOfDate?: string,
  disbursements?: Disbursement[]
): { interestAmount: number; principalAmount: number; interestRemaining: number; principalRemaining: number; unallocated: number } {
  const totalDisbursed = sum(effectiveDisbursements(loan, disbursements), (d) => d.amount);
  const principalPaid = sum(existingPayments, (p) => p.principalAmount);
  const interestPaid = sum(existingPayments, (p) => p.interestAmount);
  const principalRemaining = Math.max(0, totalDisbursed - principalPaid);
  const interestRemaining = Math.max(
    0,
    calculateInterestForLoan(loan, asOfDate ?? new Date(), existingPayments, disbursements) - interestPaid
  );
  amount = Number(amount) || 0;
  let interestAmount = 0;
  let principalAmount = 0;
  if (mode === "interest") {
    interestAmount = Math.min(amount, interestRemaining);
  } else if (mode === "principal") {
    principalAmount = Math.min(amount, principalRemaining);
  } else if (mode === "custom") {
    interestAmount = Number(custom?.interestAmount) || 0;
    principalAmount = Number(custom?.principalAmount) || 0;
  } else {
    interestAmount = Math.min(amount, interestRemaining);
    principalAmount = Math.min(amount - interestAmount, principalRemaining);
  }
  return {
    interestAmount: round2(interestAmount),
    principalAmount: round2(principalAmount),
    interestRemaining: round2(interestRemaining),
    principalRemaining: round2(principalRemaining),
    unallocated: round2(amount - interestAmount - principalAmount),
  };
}

export interface LoanScheduleSegment {
  from: string;
  to: string;
  days: number;
  periods: number;
  principal: number;
  interest: number;
  event: string;
}

/** Segment-by-segment breakdown of how the accrued interest was computed — for the loan detail page's "Interest Breakdown" tab. Merges disbursements and repayments into one timeline, same as calculateInterestForLoan. */
export function getLoanSchedule(loan: Loan, payments: Payment[], asOfDate?: string | Date, disbursements?: Disbursement[]): LoanScheduleSegment[] {
  const periodDays = FREQUENCY_DAYS[loan.interestFrequency] || 30;
  const rate = Number(loan.interestRate) || 0;
  const segments: LoanScheduleSegment[] = [];

  // Same exclusion as calculateInterestForLoan: a pure interest payment
  // (principalAmount 0) doesn't change the balance, so it must not split
  // an ongoing period into two independently-rounded pieces.
  const events = [
    ...effectiveDisbursements(loan, disbursements).map((d) => ({ date: startOfDay(d.date), delta: Number(d.amount) || 0, label: `Disbursement: +${formatCurrencyPlain(Number(d.amount) || 0)}` })),
    ...payments
      .filter((p) => (Number(p.principalAmount) || 0) > 0)
      .map((p) => ({ date: startOfDay(p.paymentDate), delta: -(Number(p.principalAmount) || 0), label: `Payment ${p.id}: −${formatCurrencyPlain(p.principalAmount)} principal` })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const now = loan.status === "CANCELLED" && loan.cancelledAt ? startOfDay(loan.cancelledAt) : startOfDay(asOfDate ?? new Date());
  const firstDate = events.length ? events[0].date : startOfDay(loan.startDate);
  let segStart = firstDate;
  let principal = 0;
  // Same global, monotonic period counter as calculateInterestForLoan —
  // see that function's comment for why a per-segment ceiling would
  // double-count.
  let periodsCharged = 0;

  const push = (end: Date, event: string) => {
    if (end <= segStart) return;
    const totalPeriods = periodsOwed(daysBetween(firstDate, end), periodDays);
    const periods = Math.max(0, totalPeriods - periodsCharged);
    if (principal > 0) {
      const days = daysBetween(segStart, end);
      const interest = loan.interestType === "FIXED" ? rate * periods : (principal * rate * periods) / 100;
      segments.push({ from: segStart.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), days, periods, principal, interest: round2(interest), event });
    }
    periodsCharged = totalPeriods;
  };

  for (const ev of events) {
    if (ev.date <= segStart) {
      principal = Math.max(0, principal + ev.delta);
      continue;
    }
    if (ev.date > now) break;
    push(ev.date, ev.label);
    principal = Math.max(0, principal + ev.delta);
    segStart = ev.date;
  }
  push(now, "Accruing (today)");
  return segments;
}

function formatCurrencyPlain(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function calculateCustomerSummary(loans: Loan[], paymentsByLoan: Map<string, Payment[]>, disbursementsByLoan?: Map<string, Disbursement[]>): CustomerSummary {
  const s: CustomerSummary = {
    totalBorrowed: 0,
    principalPaid: 0,
    interestPaid: 0,
    totalPayments: 0,
    principalOutstanding: 0,
    interestOutstanding: 0,
    totalOutstanding: 0,
    activeLoans: 0,
    completedLoans: 0,
    overdueLoans: 0,
    totalLoans: loans.length,
    lastPaymentDate: null,
    firstLoanDate: null,
  };
  for (const loan of loans) {
    const payments = paymentsByLoan.get(loan.id) ?? [];
    const b = calculateLoanBalance(loan, payments, undefined, disbursementsByLoan?.get(loan.id));
    const st = getLoanStatus(loan, b);
    if (st === "CANCELLED") {
      s.principalPaid += b.principalPaid;
      s.interestPaid += b.interestPaid;
      continue;
    }
    if (!s.firstLoanDate || loan.startDate < s.firstLoanDate) s.firstLoanDate = loan.startDate;
    s.totalBorrowed += b.principal;
    s.principalPaid += b.principalPaid;
    s.interestPaid += b.interestPaid;
    s.principalOutstanding += b.principalRemaining;
    s.interestOutstanding += b.interestRemaining;
    if (st === "PAID") s.completedLoans++;
    else if (st === "OVERDUE") {
      s.overdueLoans++;
      s.activeLoans++;
    } else s.activeLoans++;
    if (b.lastPaymentDate && (!s.lastPaymentDate || b.lastPaymentDate > s.lastPaymentDate)) {
      s.lastPaymentDate = b.lastPaymentDate;
    }
  }
  s.totalPayments = round2(s.principalPaid + s.interestPaid);
  s.totalOutstanding = round2(s.principalOutstanding + s.interestOutstanding);
  return s;
}

export function getDashboardStats(loans: Loan[], payments: Payment[], customerCount: number, todayStr: string, disbursementsByLoan?: Map<string, Disbursement[]>): DashboardStats {
  const s: DashboardStats = {
    totalMoneyLent: 0,
    principalOutstanding: 0,
    interestEarned: 0,
    interestPending: 0,
    totalCollected: 0,
    todaysCollection: 0,
    upcomingDue: 0,
    overdueAmount: 0,
    activeLoans: 0,
    overdueLoans: 0,
    paidLoans: 0,
    customers: customerCount,
  };
  const paymentsByLoan = new Map<string, Payment[]>();
  for (const p of payments) {
    const arr = paymentsByLoan.get(p.loanId) ?? [];
    arr.push(p);
    paymentsByLoan.set(p.loanId, arr);
  }
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const t0 = startOfDay(new Date());
  for (const loan of loans) {
    if (loan.status === "CANCELLED") continue;
    const b = calculateLoanBalance(loan, paymentsByLoan.get(loan.id) ?? [], undefined, disbursementsByLoan?.get(loan.id));
    const st = getLoanStatus(loan, b);
    s.totalMoneyLent += b.totalDisbursed;
    s.principalOutstanding += b.principalRemaining;
    s.interestEarned += b.interestAccrued;
    s.interestPending += b.interestRemaining;
    if (st === "OVERDUE") {
      s.overdueAmount += b.totalOutstanding;
      s.overdueLoans++;
    } else if (st === "PAID") {
      s.paidLoans++;
    } else {
      s.activeLoans++;
      const d = parseDate(loan.dueDate);
      if (d >= t0 && d <= in7) s.upcomingDue += b.totalOutstanding;
    }
  }
  s.totalCollected = sum(payments, (p) => p.amount);
  s.todaysCollection = sum(
    payments.filter((p) => p.paymentDate === todayStr),
    (p) => p.amount
  );
  return s;
}
