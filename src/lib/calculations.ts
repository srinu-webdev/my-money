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
//     monthly=30d, yearly=365d. A period that has FULLY ELAPSED is owed
//     in full, no discount for early payment within it — a completed
//     month's ₹2,000 stays ₹2,000 whether it's paid on day 31 or day 45.
//     But the CURRENTLY IN-PROGRESS period (the one still running right
//     now) accrues gradually, day by day, same as it always has — a loan
//     taken 3 days ago owes a small growing slice of a month, not the
//     whole month's rate on day one. So "Interest Accrued" is always
//     (every fully-completed period, each at its full rate) + (today's
//     running share of the period still in progress). The same rounding
//     applies to every balance-reducing segment (a partial payment still
//     leaves any already-completed period's interest owed on whatever
//     remained during it, never a partial-period credit).
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
import { addDays, daysBetween, parseDate, startOfDay, toISODate } from "./dates";
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
// How many periods have FULLY completed — 29 days into a 30-day period
// is still 0 complete periods, 30 days in is 1, 31-59 is still 1.
function periodsCompleted(days: number, periodDays: number): number {
  return days > 0 ? Math.floor(days / periodDays) : 0;
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

export interface InterestBreakdown {
  /** Every fully-completed period's interest, plus today's running share of whatever period is still in progress — this is "Interest Accrued" everywhere. */
  total: number;
  /** Just the fully-completed-and-still-unpaid-period portion of `total` — used to tell "N whole months genuinely pending" apart from today's still-growing partial-period slice, which isn't a missed/overdue month yet. */
  whole: number;
  /** The date the CURRENT (still-running) period began — everything before it is a fully-completed prior period. Used to figure out what's "this month's" interest and payments, separate from the loan's lifetime totals. */
  currentPeriodStart: string;
}

export function calculateInterestBreakdown(
  loan: Pick<Loan, "principal" | "startDate" | "interestRate" | "interestType" | "interestFrequency" | "status" | "cancelledAt">,
  asOfDate: string | Date,
  payments: PaymentLike[],
  disbursements?: DisbursementLike[]
): InterestBreakdown {
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
  // get independently charged, inflating the total (recording that an
  // interest payment was made should never itself increase how much
  // interest the loan shows as owed).
  const events = [
    ...effectiveDisbursements(loan, disbursements).map((d) => ({ date: startOfDay(d.date), delta: Number(d.amount) || 0 })),
    ...payments.filter((p) => (Number(p.principalAmount) || 0) > 0).map((p) => ({ date: startOfDay(p.paymentDate), delta: -(Number(p.principalAmount) || 0) })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const firstDate = events.length ? events[0].date : startOfDay(loan.startDate);
  if (asOf <= firstDate) return { total: 0, whole: 0, currentPeriodStart: toISODate(firstDate) };

  let segStart = firstDate;
  let bal = 0;
  let whole = 0;
  // Whole-completed-periods are counted GLOBALLY from firstDate, never
  // reset per segment — each segment is only charged for whatever NEW
  // whole periods its own end newly completes (at that segment's own
  // balance), so splitting the timeline at a balance-changing event can
  // never double-charge a period that was already complete.
  let periodsCharged = 0;
  const accrueWholeSegment = (segEnd: Date) => {
    if (segEnd <= segStart) return;
    const totalPeriods = periodsCompleted(daysBetween(firstDate, segEnd), periodDays);
    const newPeriods = Math.max(0, totalPeriods - periodsCharged);
    if (newPeriods > 0 && bal > 0) {
      whole += loan.interestType === "FIXED" ? rate * newPeriods : bal * (rate / 100) * newPeriods;
    }
    periodsCharged = totalPeriods;
  };
  for (const ev of events) {
    if (ev.date <= segStart) {
      bal = Math.max(0, bal + ev.delta);
      continue;
    }
    // A payment/disbursement dated TODAY has already happened by the time
    // we're asking "how much is owed as of today" — matching getLoanSchedule
    // below (strict `>`, not `>=`). Excluding same-day events here caused a
    // paid-off loan to keep accruing a phantom fractional amount on its old
    // balance for the rest of the day it was actually settled.
    if (ev.date > asOf) break;
    accrueWholeSegment(ev.date);
    bal = Math.max(0, bal + ev.delta);
    segStart = ev.date;
  }
  accrueWholeSegment(asOf);

  // The period still in progress (since the last completed boundary)
  // accrues continuously at today's balance — never a lump full-period
  // charge on day one.
  const daysIntoCurrentPeriod = daysBetween(firstDate, asOf) - periodsCharged * periodDays;
  let fractional = 0;
  if (daysIntoCurrentPeriod > 0 && bal > 0) {
    const fraction = daysIntoCurrentPeriod / periodDays;
    fractional = loan.interestType === "FIXED" ? rate * fraction : bal * (rate / 100) * fraction;
  }

  const currentPeriodStart = toISODate(addDays(firstDate, periodsCharged * periodDays));
  return { total: Math.max(0, round2(whole + fractional)), whole: Math.max(0, round2(whole)), currentPeriodStart };
}

export function calculateInterestForLoan(
  loan: Pick<Loan, "principal" | "startDate" | "interestRate" | "interestType" | "interestFrequency" | "status" | "cancelledAt">,
  asOfDate: string | Date,
  payments: PaymentLike[],
  disbursements?: DisbursementLike[]
): number {
  return calculateInterestBreakdown(loan, asOfDate, payments, disbursements).total;
}

export function interestPerPeriod(
  loan: Pick<Loan, "interestRate" | "interestType">,
  principal: number
): number {
  const rate = Number(loan.interestRate) || 0;
  return loan.interestType === "FIXED" ? rate : (principal * rate) / 100;
}

// A loan's day-of-month at disbursement doubles as its recurring monthly
// collection day (given on the 10th -> collected on the 10th every month
// after). `collectionDayOverride` lets the lender pin a fixed collection
// day instead (e.g. always the 15th, regardless of when the loan itself
// started) — pass `loan.collectionDay`. Finds the NEXT occurrence of
// that day from `asOfDate`, clamped to the last day of a shorter month
// (a "31st" loan collects on the 28th/29th in February). Only
// meaningful for MONTHLY-frequency loans with a recurring collection
// cycle (not Daily Installment).
export function nextMonthlyCollectionDate(startDateIso: string, asOfDate?: string | Date, collectionDayOverride?: number | null): { date: string; daysUntil: number } {
  const dueDay = collectionDayOverride ?? parseDate(startDateIso).getDate();
  const t0 = startOfDay(asOfDate ?? new Date());
  const y = t0.getFullYear();
  const m = t0.getMonth();
  const clampedThisMonth = Math.min(dueDay, new Date(y, m + 1, 0).getDate());
  let candidate = new Date(y, m, clampedThisMonth);
  if (candidate < t0) {
    const clampedNextMonth = Math.min(dueDay, new Date(y, m + 2, 0).getDate());
    candidate = new Date(y, m + 1, clampedNextMonth);
  }
  const daysUntil = Math.round((candidate.getTime() - t0.getTime()) / 86400000);
  return { date: toISODate(candidate), daysUntil };
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
  const breakdown = calculateInterestBreakdown(loan, asOfDate ?? new Date(), payments, disbursements);
  const interestAccrued = breakdown.total;
  const interestRemaining = Math.max(0, round2(interestAccrued - interestPaid));
  // Payments are assumed to settle the oldest debt first (completed
  // periods before today's still-growing partial one) — the natural,
  // sensible order, and matches how interest allocation already works.
  const interestPendingWhole = Math.max(0, round2(breakdown.whole - interestPaid));
  // "This month" = the period currently running (strictly after
  // currentPeriodStart, up to today) — separate from the loan's lifetime
  // totals, for a per-cycle view of what's due right now vs already
  // settled. A payment dated ON the boundary itself is treated as
  // settling the period that just ended, not prepaying the new one.
  const interestPaidThisPeriod = round2(sum(payments.filter((p) => p.paymentDate > breakdown.currentPeriodStart), (p) => p.interestAmount));
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
    interestPendingWhole,
    interestPaidThisPeriod,
  };
}

// Status is DERIVED — never trust `loan.status` alone except for the
// manual Cancelled / (fully paid) Paid states.
export function getLoanStatus(loan: Pick<Loan, "status" | "dueDate">, bal: LoanBalance): LoanStatus {
  if (loan.status === "CANCELLED") return "CANCELLED";
  if (bal.totalOutstanding <= 1) return "PAID";
  const due = parseDate(loan.dueDate);
  if (due < startOfDay(new Date())) return "OVERDUE";
  // "Partially Paid" means actual progress toward closing the loan —
  // some of the PRINCIPAL is repaid. Regularly paying interest (the
  // normal, expected behaviour of an Interest Only loan) isn't partial
  // progress toward anything; it stays "Active" until principal moves.
  if (bal.principalPaid > 0) return "PARTIALLY_PAID";
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
  // Same global, monotonic whole-period counter as calculateInterestBreakdown
  // — see that function's comment for why a per-segment count would
  // double-charge, and why only FULLY completed periods count here.
  let periodsCharged = 0;

  const push = (end: Date, event: string) => {
    if (end <= segStart) return;
    const totalPeriods = periodsCompleted(daysBetween(firstDate, end), periodDays);
    const periods = Math.max(0, totalPeriods - periodsCharged);
    if (principal > 0 && periods > 0) {
      // Show the row ending at the actual period boundary reached, not
      // at whatever `end` was passed (which for the final call is
      // "today") — otherwise this row's date range would visually
      // overlap the separate "still accruing" row that follows it.
      const boundaryEnd = addDays(firstDate, totalPeriods * periodDays);
      const days = daysBetween(segStart, boundaryEnd);
      const interest = loan.interestType === "FIXED" ? rate * periods : (principal * rate * periods) / 100;
      segments.push({ from: toISODate(segStart), to: toISODate(boundaryEnd), days, periods, principal, interest: round2(interest), event });
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
  push(now, "Period completed");

  // The period still running right now accrues gradually — shown as its
  // own row, distinct from the completed-period rows above, so it never
  // reads as "another full month owed" before it actually is one.
  const daysIntoCurrentPeriod = daysBetween(firstDate, now) - periodsCharged * periodDays;
  if (daysIntoCurrentPeriod > 0 && principal > 0) {
    const fraction = daysIntoCurrentPeriod / periodDays;
    const interest = loan.interestType === "FIXED" ? rate * fraction : (principal * rate * fraction) / 100;
    const boundaryStart = addDays(firstDate, periodsCharged * periodDays);
    segments.push({
      from: toISODate(boundaryStart),
      to: toISODate(now),
      days: daysIntoCurrentPeriod,
      periods: 0,
      principal,
      interest: round2(interest),
      event: "Current period accruing (not yet complete)",
    });
  }

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
