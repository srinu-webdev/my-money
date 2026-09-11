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
//     monthly=one real calendar month (anchored to the start date's
//     day-of-month, 28-31 days), yearly=365d. A period that has FULLY ELAPSED is owed
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
import { addDays, businessNow, daysBetween, parseDate, startOfDay, toISODate } from "./dates";
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
// is still 0 complete periods, 30 days in is 1, 31-59 is still 1. Used
// for DAILY/WEEKLY/YEARLY frequencies, where a period is a fixed number
// of days.
function periodsCompleted(days: number, periodDays: number): number {
  return days > 0 ? Math.floor(days / periodDays) : 0;
}

// MONTHLY frequency uses REAL calendar months anchored to a specific
// day-of-month (the day the loan's money changed hands), not a rigid 30-day block —
// a month is 28-31 days depending which one it is, and a loan taken on
// the 10th is due on the 10th of the next calendar month, not "30 days
// later" (which lands on the 9th for a 31-day month like August, a day
// early). Returns how many full collection cycles have completed by
// `asOf`, the boundary date the most recent one completed on (= the
// start of the period still running), and that in-progress period's
// actual length in days (needed to prorate today's partial share —
// never a fixed 30, since real months vary).
function monthlyPeriodInfo(firstDate: Date, asOf: Date, anchorDay: number): { count: number; lastBoundary: Date; currentPeriodLengthDays: number } {
  const startY = firstDate.getFullYear();
  const startM = firstDate.getMonth();
  let count = 0;
  let lastBoundary = firstDate;
  let nextBoundary = firstDate;
  for (let i = 0; i <= 1200; i++) {
    const y = startY;
    const m = startM + i;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const candidate = new Date(y, m, Math.min(anchorDay, daysInMonth));
    if (candidate <= firstDate) continue; // this occurrence is at/before the period even started
    if (candidate <= asOf) {
      count++;
      lastBoundary = candidate;
      continue;
    }
    nextBoundary = candidate;
    break;
  }
  const currentPeriodLengthDays = Math.max(1, Math.round((nextBoundary.getTime() - lastBoundary.getTime()) / 86400000));
  return { count, lastBoundary, currentPeriodLengthDays };
}
function sum<T>(arr: T[], fn: (x: T) => number): number {
  return arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0);
}

type DisbursementLike = Pick<Disbursement, "date" | "amount">;
type PaymentLike = Pick<Payment, "paymentDate" | "principalAmount">;

/** Disbursement rows if any exist, otherwise a single synthesized handover of the full principal on the start date — keeps every caller that doesn't know about tranches working unchanged. Exported so UI code (e.g. a "recent transactions" feed) can show the real disbursal event for the common single-handover loan too, not just loans with explicit tranche rows. */
export function effectiveDisbursements(loan: Pick<Loan, "principal" | "startDate">, disbursements?: DisbursementLike[]): DisbursementLike[] {
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
  const isMonthly = loan.interestFrequency === "MONTHLY";
  // Accrual anchors to the day the money actually changed hands — NOT
  // loan.collectionDay. The collection day is only when the lender goes
  // to collect (due-date display, Due Payments list, reminder cron); if
  // it also moved the accrual boundaries, overriding a loan started on
  // the 10th to "collect on the 15th" would re-carve its history into a
  // 5-day stub charged as a whole month, rewriting cycles the customer
  // has already settled.
  const anchorDay = parseDate(loan.startDate).getDate();

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
    const totalPeriods = isMonthly ? monthlyPeriodInfo(firstDate, segEnd, anchorDay).count : periodsCompleted(daysBetween(firstDate, segEnd), periodDays);
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
  // charge on day one. For MONTHLY loans this uses the CURRENT period's
  // real length (28-31 days, whatever that calendar month actually is),
  // not a fixed 30 — a day into a 31-day month is a smaller fraction
  // than a day into February.
  let daysIntoCurrentPeriod: number;
  let currentPeriodLength: number;
  let periodStartDate: Date;
  if (isMonthly) {
    const info = monthlyPeriodInfo(firstDate, asOf, anchorDay);
    periodStartDate = info.lastBoundary;
    daysIntoCurrentPeriod = daysBetween(info.lastBoundary, asOf);
    currentPeriodLength = info.currentPeriodLengthDays;
  } else {
    periodStartDate = addDays(firstDate, periodsCharged * periodDays);
    daysIntoCurrentPeriod = daysBetween(firstDate, asOf) - periodsCharged * periodDays;
    currentPeriodLength = periodDays;
  }
  let fractional = 0;
  if (daysIntoCurrentPeriod > 0 && bal > 0) {
    const fraction = daysIntoCurrentPeriod / currentPeriodLength;
    fractional = loan.interestType === "FIXED" ? rate * fraction : bal * (rate / 100) * fraction;
  }

  const currentPeriodStart = toISODate(periodStartDate);
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

export interface StrictCycleGap {
  /** Total interest still unmatched under strict per-cycle rules — 0 if every completed cycle has its own qualifying payment. */
  amount: number;
  /** The end date of the EARLIEST completed cycle without a qualifying payment, or null if there's no gap. */
  sinceDate: string | null;
}

type PaymentLikeInterest = Pick<Payment, "paymentDate" | "interestAmount" | "principalAmount">;

// MONTHLY-only, by explicit request: each recurring monthly cycle must be
// settled by its OWN payment(s), dated on or after that cycle's own end
// date — a payment made DURING a cycle (before it ends) can't be credited
// to it, only to whichever cycle(s) it has actually reached by its date.
// This is a genuinely different rule from the interestPendingWhole/
// interestRemaining/interestAccrued math elsewhere in this file, which
// track a plain running total (how much is owed vs how much has ever come
// in) and are untouched by this — this function exists ONLY to answer "is
// there a specific past cycle nobody has actually paid for," for Overdue
// classification, not to change how much money the loan shows as owed.
//
// Each cycle's own cost is the INCREMENTAL accrual between consecutive
// boundaries, taken from calculateInterestBreakdown itself (not re-derived
// here) so a mid-loan principal repayment or disbursement tranche that
// changes the balance is still accounted for correctly. Payments are
// matched oldest-cycle-first, greedily, from whichever qualifying (date >=
// that cycle's end) payment is earliest — a payment's leftover after
// settling one cycle can still apply to a later one, but only if its own
// date also reaches that later cycle's end.
export function strictCycleGap(
  loan: Pick<Loan, "principal" | "startDate" | "interestRate" | "interestType" | "interestFrequency" | "status" | "cancelledAt">,
  asOfDate: string | Date,
  payments: PaymentLikeInterest[],
  disbursements?: DisbursementLike[]
): StrictCycleGap {
  if (loan.interestFrequency !== "MONTHLY") return { amount: 0, sinceDate: null };
  const asOf = startOfDay(asOfDate);
  const anchorDay = parseDate(loan.startDate).getDate();
  const firstEventDate = effectiveDisbursements(loan, disbursements).reduce(
    (min, d) => (startOfDay(d.date) < min ? startOfDay(d.date) : min),
    startOfDay(loan.startDate)
  );

  // Every completed cycle's own end date, oldest first — mirrors
  // monthlyPeriodInfo's boundary walk above so the two never disagree.
  const boundaries: Date[] = [];
  const startY = firstEventDate.getFullYear();
  const startM = firstEventDate.getMonth();
  for (let i = 0; i <= 1200; i++) {
    const y = startY;
    const m = startM + i;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const candidate = new Date(y, m, Math.min(anchorDay, daysInMonth));
    if (candidate <= firstEventDate) continue;
    if (candidate > asOf) break;
    boundaries.push(candidate);
  }
  if (!boundaries.length) return { amount: 0, sinceDate: null };

  let prevWhole = 0;
  const cycles = boundaries.map((end) => {
    const whole = calculateInterestBreakdown(loan, end, payments, disbursements).whole;
    const cost = round2(whole - prevWhole);
    prevWhole = whole;
    return { end, cost };
  });

  const pool = payments
    .map((p) => ({ date: startOfDay(p.paymentDate), remaining: round2(Number(p.interestAmount) || 0) }))
    .filter((p) => p.remaining > 0.01)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let totalGap = 0;
  let sinceDate: string | null = null;
  for (const cycle of cycles) {
    if (cycle.cost <= 0.01) continue;
    let covered = 0;
    for (const p of pool) {
      if (covered >= cycle.cost - 0.01) break;
      if (p.remaining <= 0.01 || p.date < cycle.end) continue;
      const take = Math.min(p.remaining, round2(cycle.cost - covered));
      covered = round2(covered + take);
      p.remaining = round2(p.remaining - take);
    }
    const shortfall = round2(cycle.cost - covered);
    if (shortfall > 0.01) {
      totalGap = round2(totalGap + shortfall);
      if (!sinceDate) sinceDate = toISODate(cycle.end);
    }
  }
  return { amount: totalGap, sinceDate };
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
  const t0 = startOfDay(asOfDate ?? businessNow());
  const start = startOfDay(startDateIso);
  const y = t0.getFullYear();
  const m = t0.getMonth();
  let candidate = new Date(y, m, Math.min(dueDay, new Date(y, m + 1, 0).getDate()));
  // Roll forward until the occurrence is both not in the past AND strictly
  // after the loan's start date. A loan given today must be first due NEXT
  // month, not today — same guard the accrual engine (monthlyPeriodInfo)
  // already applies. Still returns today when today genuinely IS an
  // ongoing loan's collection day.
  for (let k = 1; k <= 24 && (candidate < t0 || candidate <= start); k++) {
    candidate = new Date(y, m + k, Math.min(dueDay, new Date(y, m + k + 1, 0).getDate()));
  }
  const daysUntil = Math.round((candidate.getTime() - t0.getTime()) / 86400000);
  return { date: toISODate(candidate), daysUntil };
}

// A completed monthly period's interest is genuinely owed from the moment
// its due date arrives — that's real accrual and isn't touched here. A
// grace period (days past that due date before it counts as genuinely
// "pending"/overdue) was tried at 5 days and then explicitly removed —
// the lender wants a period flagged the day after it's due, no leeway.
// Kept as a named constant rather than inlining `> 0` so the exact
// business rule stays a single, clearly-labeled place to change again.
// This only affects interestPendingWhole (the "N whole months pending"
// flag used for status and "X months pending" displays everywhere) —
// interestAccrued / interestRemaining / totalOutstanding keep accruing
// exactly as before regardless of this value.
const MONTHLY_INTEREST_GRACE_DAYS = 0;

export function calculateLoanBalance(loan: Loan, payments: Payment[], asOfDate?: string | Date, disbursements?: Disbursement[]): LoanBalance {
  const today = startOfDay(asOfDate ?? businessNow());
  const principal = Number(loan.principal) || 0;
  const totalDisbursed = round2(sum(effectiveDisbursements(loan, disbursements), (d) => d.amount));
  const pendingDisbursement = Math.max(0, round2(principal - totalDisbursed));
  const principalPaid = round2(sum(payments, (p) => p.principalAmount));
  const interestPaid = round2(sum(payments, (p) => p.interestAmount));
  // What's owed is measured against what's actually been handed over, not
  // the full agreed amount — money not yet disbursed isn't debt yet.
  const principalRemaining = Math.max(0, round2(totalDisbursed - principalPaid));
  const breakdown = calculateInterestBreakdown(loan, today, payments, disbursements);
  const interestAccrued = breakdown.total;
  const interestRemaining = Math.max(0, round2(interestAccrued - interestPaid));
  // For MONTHLY loans, whether a specific recurring cycle counts as "paid"
  // uses strict per-cycle matching (see strictCycleGap) — a payment made
  // DURING a cycle can't be credited to it, only to whichever cycle(s) its
  // own date has actually reached. Other frequencies keep the simpler
  // running-total comparison (whole periods accrued vs lifetime paid).
  // Either way this is purely a CLASSIFICATION signal — interestAccrued /
  // interestRemaining / totalOutstanding above are untouched, so the real
  // rupee amount owed is never affected by which rule decided "overdue."
  const isMonthly = loan.interestFrequency === "MONTHLY";
  const strictGap = isMonthly ? strictCycleGap(loan, today, payments, disbursements) : null;
  const rawInterestPendingWhole = strictGap ? strictGap.amount : Math.max(0, round2(breakdown.whole - interestPaid));
  const pendingSinceDate = strictGap ? strictGap.sinceDate : rawInterestPendingWhole > 0.01 ? breakdown.currentPeriodStart : null;
  const daysSincePeriodEnded = pendingSinceDate ? daysBetween(pendingSinceDate, today) : 0;
  const interestPendingWhole = daysSincePeriodEnded > MONTHLY_INTEREST_GRACE_DAYS ? rawInterestPendingWhole : 0;
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
  const due = parseDate(loan.dueDate);
  // Overdue on the final due date takes priority; otherwise, if a whole
  // completed interest period is still unpaid, "overdue" means overdue
  // since that period's own boundary (breakdown.currentPeriodStart is
  // exactly when it ended), not the loan's far-off final due date.
  const overdueOnFinalDueDate = due && due < today && totalOutstanding > 0;
  const daysOverdue = overdueOnFinalDueDate ? daysBetween(due, today) : interestPendingWhole > 0.01 ? daysSincePeriodEnded : 0;
  // The date daysOverdue is actually counted FROM — paired with it so a
  // UI never shows "Nd overdue" next to the wrong date. A UI that instead
  // reached for loan.dueDate directly (the far-off final maturity date)
  // showed a bizarre "1d overdue, due next month" once a loan could go
  // Overdue from an unpaid interest period alone, not just its own due date.
  const daysOverdueSince: string | null = overdueOnFinalDueDate ? loan.dueDate : interestPendingWhole > 0.01 ? pendingSinceDate : null;
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
    daysOverdue,
    daysOverdueSince,
    interestPerPeriod: interestPerPeriod(loan, principalRemaining),
    totalDisbursed,
    pendingDisbursement,
    interestPendingWhole,
    interestPendingWholeRaw: rawInterestPendingWhole,
    // The pending amount's own "since" date when there's a gap (the strict-
    // matching model's unmatched cycle, or the plain running-total model's
    // boundary) — falls back to the current running period's start so a UI
    // that shows this unconditionally (there isn't one today, but exposing
    // it) still gets something sensible when nothing is pending.
    currentPeriodStart: pendingSinceDate ?? breakdown.currentPeriodStart,
    interestPaidThisPeriod,
  };
}

// Status is DERIVED — never trust `loan.status` alone except for the
// manual Cancelled / (fully paid) Paid states.
export function getLoanStatus(loan: Pick<Loan, "status" | "dueDate">, bal: LoanBalance): LoanStatus {
  if (loan.status === "CANCELLED") return "CANCELLED";
  if (bal.totalOutstanding <= 1) return "PAID";
  const due = parseDate(loan.dueDate);
  if (due < businessNow()) return "OVERDUE";
  // A loan can also be overdue on a recurring interest installment well
  // before its own final term ends — a full period that's already
  // finished with its interest still entirely unpaid (interestPendingWhole)
  // means a payment was actually missed, not just "not due yet". Flagging
  // this as OVERDUE (rather than leaving it "Active" with a small caption
  // most people scanning a status column would miss) is what a lender
  // actually needs to see. interestPendingWhole already holds off for
  // MONTHLY_INTEREST_GRACE_DAYS past the due date before counting a period
  // as genuinely pending, so a payment due today isn't instantly flagged.
  // This doesn't touch how interest accrues or is allocated — only how the
  // already-correct numbers get classified.
  if (bal.interestPendingWhole > 0.01) return "OVERDUE";
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
    calculateInterestForLoan(loan, asOfDate ?? businessNow(), existingPayments, disbursements) - interestPaid
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
  const isMonthly = loan.interestFrequency === "MONTHLY";
  // Accrual anchors to the day the money actually changed hands — NOT
  // loan.collectionDay. The collection day is only when the lender goes
  // to collect (due-date display, Due Payments list, reminder cron); if
  // it also moved the accrual boundaries, overriding a loan started on
  // the 10th to "collect on the 15th" would re-carve its history into a
  // 5-day stub charged as a whole month, rewriting cycles the customer
  // has already settled.
  const anchorDay = parseDate(loan.startDate).getDate();
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

  const now = loan.status === "CANCELLED" && loan.cancelledAt ? startOfDay(loan.cancelledAt) : startOfDay(asOfDate ?? businessNow());
  const firstDate = events.length ? events[0].date : startOfDay(loan.startDate);
  let segStart = firstDate;
  let principal = 0;
  // Same global, monotonic whole-period counter as calculateInterestBreakdown
  // — see that function's comment for why a per-segment count would
  // double-charge, and why only FULLY completed periods count here.
  let periodsCharged = 0;

  const push = (end: Date, event: string) => {
    if (end <= segStart) return;
    const totalPeriods = isMonthly ? monthlyPeriodInfo(firstDate, end, anchorDay).count : periodsCompleted(daysBetween(firstDate, end), periodDays);
    const periods = Math.max(0, totalPeriods - periodsCharged);
    if (principal > 0 && periods > 0) {
      // Show the row ending at the actual period boundary reached, not
      // at whatever `end` was passed (which for the final call is
      // "today") — otherwise this row's date range would visually
      // overlap the separate "still accruing" row that follows it.
      const boundaryEnd = isMonthly ? monthlyPeriodInfo(firstDate, end, anchorDay).lastBoundary : addDays(firstDate, totalPeriods * periodDays);
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
  // reads as "another full month owed" before it actually is one. For
  // MONTHLY loans this uses the current calendar month's real length
  // (28-31 days), not a fixed 30.
  let daysIntoCurrentPeriod: number;
  let currentPeriodLength: number;
  let boundaryStart: Date;
  if (isMonthly) {
    const info = monthlyPeriodInfo(firstDate, now, anchorDay);
    boundaryStart = info.lastBoundary;
    daysIntoCurrentPeriod = daysBetween(info.lastBoundary, now);
    currentPeriodLength = info.currentPeriodLengthDays;
  } else {
    boundaryStart = addDays(firstDate, periodsCharged * periodDays);
    daysIntoCurrentPeriod = daysBetween(firstDate, now) - periodsCharged * periodDays;
    currentPeriodLength = periodDays;
  }
  if (daysIntoCurrentPeriod > 0 && principal > 0) {
    const fraction = daysIntoCurrentPeriod / currentPeriodLength;
    const interest = loan.interestType === "FIXED" ? rate * fraction : (principal * rate * fraction) / 100;
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
    upcomingDueLoans: 0,
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
  // Derived from the passed-in `todayStr`, not a fresh `new Date()` — the
  // caller already resolved "today" in the business timezone; a second,
  // independent server-clock read here could silently disagree with it
  // right around midnight IST.
  const t0 = startOfDay(todayStr);
  const in7 = addDays(t0, 7);
  for (const loan of loans) {
    if (loan.status === "CANCELLED") continue;
    const b = calculateLoanBalance(loan, paymentsByLoan.get(loan.id) ?? [], undefined, disbursementsByLoan?.get(loan.id));
    const st = getLoanStatus(loan, b);
    s.totalMoneyLent += b.totalDisbursed;
    s.principalOutstanding += b.principalRemaining;
    s.interestEarned += b.interestAccrued;
    s.interestPending += b.interestRemaining;
    if (st === "OVERDUE") {
      // What's actually "overdue" depends on WHY this loan is flagged that
      // way (mirrors getLoanStatus's own check order): once the loan's own
      // final due date has passed, the whole remaining balance — principal
      // included — is now due, not just interest. Before that, the loan's
      // term itself isn't up yet; only a missed periodic interest cycle is
      // late, so the principal isn't part of what's overdue.
      s.overdueAmount += parseDate(loan.dueDate) < t0 ? b.totalOutstanding : b.interestPendingWhole;
      s.overdueLoans++;
    } else if (st === "PAID") {
      s.paidLoans++;
    } else {
      s.activeLoans++;
      const d = parseDate(loan.dueDate);
      if (d >= t0 && d <= in7) {
        s.upcomingDue += b.totalOutstanding;
        s.upcomingDueLoans++;
      }
    }
  }
  s.totalCollected = sum(payments, (p) => p.amount);
  s.todaysCollection = sum(
    payments.filter((p) => p.paymentDate === todayStr),
    (p) => p.amount
  );
  return s;
}
