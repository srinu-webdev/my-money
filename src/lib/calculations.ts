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
import { addDays, addMonths, businessNow, daysBetween, parseDate, startOfDay, toISODate } from "./dates";
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

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}
interface PeriodBoundary {
  start: Date;
  end: Date;
  /** The FULL length of this period in days — even for the trailing in-progress period, where it's the denominator for prorating today's partial share, not `end - start` (which for that one is just "how far we've gotten so far"). */
  length: number;
  complete: boolean;
}

// Splits [firstDate, asOf] into consecutive accrual periods, oldest first.
// MONTHLY and YEARLY periods are REAL calendar months/years anchored to
// `anchorDate`'s day-of-month (and, for yearly, its month too) — 28-31 days
// for a month, 365 or 366 for a year, clamped to the target month's actual
// length (a "31st" or a "29 Feb" anchor lands on the last real day of a
// shorter month / a non-leap February, same idea either way — a leap-year
// YEARLY loan no longer drifts a day early the way a flat 365-day period
// would). DAILY/WEEKLY periods are a fixed number of days. The final
// period is marked `complete: false` when `asOf` falls before its natural
// end (the period still running).
function getPeriodBoundaries(firstDate: Date, asOf: Date, frequency: InterestFrequency, anchorDate: Date, periodDays: number): PeriodBoundary[] {
  const periods: PeriodBoundary[] = [];
  if (frequency === "MONTHLY" || frequency === "YEARLY") {
    const anchorDay = anchorDate.getDate();
    const step = frequency === "YEARLY" ? 12 : 1;
    const startY = firstDate.getFullYear();
    const startM = firstDate.getMonth();
    let prev = firstDate;
    for (let i = 0; i <= 1200; i++) {
      const m = startM + i * step;
      const daysInMonth = new Date(startY, m + 1, 0).getDate();
      const candidate = new Date(startY, m, Math.min(anchorDay, daysInMonth));
      if (candidate <= firstDate) continue; // this occurrence is at/before the period even started
      const length = Math.max(1, Math.round((candidate.getTime() - prev.getTime()) / 86400000));
      if (candidate <= asOf) {
        periods.push({ start: prev, end: candidate, length, complete: true });
        prev = candidate;
        continue;
      }
      if (asOf > prev) periods.push({ start: prev, end: asOf, length, complete: false });
      break;
    }
  } else {
    let prev = firstDate;
    for (let i = 0; i <= 200000; i++) {
      const candidate = addDays(firstDate, (i + 1) * periodDays);
      if (candidate <= asOf) {
        periods.push({ start: prev, end: candidate, length: periodDays, complete: true });
        prev = candidate;
        continue;
      }
      if (asOf > prev) periods.push({ start: prev, end: asOf, length: periodDays, complete: false });
      break;
    }
  }
  return periods;
}

// One period's contribution for the days a given balance was actually
// outstanding DURING it (days/length of that period) — the same
// day-weighted idea already used for "today's running share of the period
// still in progress", now applied uniformly to every balance-holding span
// within every period, not just the trailing one. This is what makes a
// mid-period principal repayment or disbursement tranche split a period's
// interest correctly between the balances that actually applied, instead
// of billing the whole period at whichever balance happened to be current
// when the period's boundary was finally reached.
function periodContribution(bal: number, days: number, periodLength: number, interestType: "PERCENTAGE" | "FIXED", rate: number): number {
  if (bal <= 0 || days <= 0) return 0;
  const fraction = days / periodLength;
  return interestType === "FIXED" ? rate * fraction : bal * (rate / 100) * fraction;
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
  loan: Pick<Loan, "principal" | "startDate" | "interestRate" | "interestType" | "interestFrequency" | "status" | "cancelledAt" | "paidAt">,
  asOfDate: string | Date,
  payments: PaymentLike[],
  disbursements?: DisbursementLike[]
): InterestBreakdown {
  let asOf = startOfDay(asOfDate);
  if (loan.status === "CANCELLED" && loan.cancelledAt) {
    const c = startOfDay(loan.cancelledAt);
    if (c < asOf) asOf = c; // accrual stops at cancellation
  }
  if (loan.status === "PAID" && loan.paidAt) {
    // Same idea as cancellation: once a loan is fully settled, accrual
    // must stop for good — otherwise a leftover few-paisa residual (e.g.
    // ₹0.33) keeps accruing a fraction of a paisa every period forever,
    // and given enough years could silently push totalOutstanding back
    // over the PAID threshold, flipping a genuinely completed loan back
    // to OVERDUE with no payment ever having been missed.
    const p = startOfDay(loan.paidAt);
    if (p < asOf) asOf = p;
  }

  const rate = Number(loan.interestRate) || 0;
  const periodDays = FREQUENCY_DAYS[loan.interestFrequency] || 30;
  // Accrual anchors to the day the money actually changed hands — NOT
  // loan.collectionDay. The collection day is only when the lender goes
  // to collect (due-date display, Due Payments list, reminder cron); if
  // it also moved the accrual boundaries, overriding a loan started on
  // the 10th to "collect on the 15th" would re-carve its history into a
  // 5-day stub charged as a whole month, rewriting cycles the customer
  // has already settled.
  const anchorDate = parseDate(loan.startDate);

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

  // Apply any events dated at/before firstDate up front (e.g. two same-day
  // disbursements) so `bal` starts each period walk already correct.
  let bal = 0;
  let idx = 0;
  while (idx < events.length && events[idx].date <= firstDate) {
    bal = Math.max(0, bal + events[idx].delta);
    idx++;
  }

  // Walk period-by-period (not just balance-change-by-balance-change): a
  // period can span multiple balances (an early partial repayment mid-
  // cycle) or a balance can span multiple periods (nothing changes for
  // months) — either way, each period's own interest is the SUM of every
  // balance's day-weighted share of it, so a mid-period balance change
  // splits that one period's interest between the balances that actually
  // applied, instead of billing the whole period at whichever balance
  // happened to be current once the period's boundary was finally reached.
  const periods = getPeriodBoundaries(firstDate, asOf, loan.interestFrequency, anchorDate, periodDays);
  let whole = 0;
  let fractional = 0;
  let currentPeriodStart = firstDate;
  for (const period of periods) {
    let segStart = period.start;
    let periodInterest = 0;
    // A payment/disbursement dated TODAY has already happened by the time
    // we're asking "how much is owed as of today" (strict `<=` against
    // asOf/period.end) — excluding same-day events here caused a paid-off
    // loan to keep accruing a phantom amount on its old balance for the
    // rest of the day it was actually settled.
    while (idx < events.length && events[idx].date <= period.end && events[idx].date > segStart) {
      periodInterest += periodContribution(bal, daysBetween(segStart, events[idx].date), period.length, loan.interestType, rate);
      bal = Math.max(0, bal + events[idx].delta);
      segStart = events[idx].date;
      idx++;
    }
    periodInterest += periodContribution(bal, daysBetween(segStart, period.end), period.length, loan.interestType, rate);
    if (period.complete) whole += periodInterest;
    else fractional += periodInterest;
    currentPeriodStart = period.complete ? period.end : period.start;
  }

  return {
    total: Math.max(0, round2(whole + fractional)),
    whole: Math.max(0, round2(whole)),
    currentPeriodStart: toISODate(currentPeriodStart),
  };
}

export function calculateInterestForLoan(
  loan: Pick<Loan, "principal" | "startDate" | "interestRate" | "interestType" | "interestFrequency" | "status" | "cancelledAt" | "paidAt">,
  asOfDate: string | Date,
  payments: PaymentLike[],
  disbursements?: DisbursementLike[]
): number {
  return calculateInterestBreakdown(loan, asOfDate, payments, disbursements).total;
}

export interface DailyInstallmentPlan {
  /** The fixed day-one rate: (principal + full-term interest) spread evenly across the loan's whole term. Shown for reference — never what's actually required going forward once payment history exists. */
  dailyAmount: number;
  totalDays: number;
  totalPayable: number;
  daysElapsed: number;
  expectedByNow: number;
  aheadOrBehind: number;
  catchUpAmount: number;
  missedDays: number;
  projectedTotal: number;
  projectedShortfall: number;
  /** What's still owed against the original full-term total. */
  remainingAmount: number;
  /** Days left until the due date (never less than 1, so this is always a divisor). */
  remainingDays: number;
  /** THE headline figure: remainingAmount / remainingDays — recalculated fresh from whatever actually happened, never the fixed day-one rate. */
  requiredDailyNow: number;
}

/**
 * Daily Installment plan — shared by the loan detail page and the daily
 * reminder notification so the two can never show different numbers for
 * the same loan on the same day. `totalPaid` is passed in rather than a
 * full LoanBalance so this stays a plain pure function.
 */
export function dailyInstallmentPlan(
  loan: Pick<Loan, "principal" | "startDate" | "dueDate" | "repaymentType" | "interestRate" | "interestType" | "interestFrequency" | "status" | "cancelledAt" | "paidAt">,
  totalPaid: number,
  asOfDate: string | Date,
  disbursements?: DisbursementLike[]
): DailyInstallmentPlan | null {
  if (loan.repaymentType !== "Daily Installment") return null;
  const totalDays = daysBetween(loan.startDate, loan.dueDate);
  if (totalDays <= 0) return null;
  const fullTermInterest = calculateInterestForLoan(loan, loan.dueDate, [], disbursements);
  const totalPayable = loan.principal + fullTermInterest;
  const dailyAmount = totalPayable / totalDays;
  const daysElapsed = Math.min(totalDays, Math.max(0, daysBetween(loan.startDate, asOfDate)));
  const expectedByNow = dailyAmount * daysElapsed;
  const aheadOrBehind = totalPaid - expectedByNow;
  // A missed day doesn't just vanish — it rolls forward and stacks on top
  // of every day after it, so "catch up" is always the full cumulative
  // gap (every missed day included), never just "yesterday".
  const catchUpAmount = Math.max(0, -aheadOrBehind);
  const missedDays = dailyAmount > 0 ? Math.round(catchUpAmount / dailyAmount) : 0;
  // Projected to the due date at today's actual average daily pace —
  // answers "will the full amount actually arrive by the due date".
  const avgDailyPace = daysElapsed > 0 ? totalPaid / daysElapsed : dailyAmount;
  const projectedTotal = avgDailyPace * totalDays;
  const projectedShortfall = Math.max(0, totalPayable - projectedTotal);
  const remainingAmount = Math.max(0, round2(totalPayable - totalPaid));
  const remainingDays = Math.max(1, totalDays - daysElapsed);
  const requiredDailyNow = round2(remainingAmount / remainingDays);
  return { dailyAmount, totalDays, totalPayable, daysElapsed, expectedByNow, aheadOrBehind, catchUpAmount, missedDays, projectedTotal, projectedShortfall, remainingAmount, remainingDays, requiredDailyNow };
}

export interface StrictCycleGap {
  /** Total interest still unmatched under strict per-cycle rules — 0 if every completed cycle has its own qualifying payment. */
  amount: number;
  /** The end date of the EARLIEST completed cycle without a qualifying payment, or null if there's no gap. */
  sinceDate: string | null;
}

type PaymentLikeInterest = Pick<Payment, "paymentDate" | "interestAmount" | "principalAmount">;

export interface MonthlyCycleStatus {
  /** This cycle's own accrual window (the month it covers). */
  start: string;
  /** This cycle's due date — also what it's labeled by (e.g. "the October cycle" is the one due in October). */
  end: string;
  amount: number;
  status: "PAID" | "OVERDUE" | "DUE" | "UPCOMING";
}

// MONTHLY-only, by explicit request: each recurring monthly cycle must be
// settled by its OWN payment(s) — but a payment dated anywhere from that
// cycle's own START onward qualifies, INCLUDING a few days early (before
// the cycle's end/due date). A payment can be credited to any cycle that
// has already begun by its date; it is never required to wait until that
// cycle is over. This matters: gating on the cycle's END date instead (an
// earlier version of this function did) meant a customer who always pays
// a few days into each new cycle — a completely normal pattern — had
// every payment quietly matched to the PREVIOUS cycle instead of its own,
// permanently shifting every cycle after it back by one and leaving the
// most recent one perpetually "unpaid" no matter how consistently they
// paid (surfaced in practice as an already-settled loan showing something
// like "Overdue – Last 50506 Months Interest" once interestPerPeriod had
// shrunk near zero from being paid down).
//
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
// matched oldest-cycle-first, greedily, from whichever qualifying payment
// is earliest — a payment's leftover after settling one cycle can still
// apply to a later one.
export function monthlyInterestSchedule(
  loan: Pick<Loan, "principal" | "startDate" | "interestRate" | "interestType" | "interestFrequency" | "status" | "cancelledAt" | "paidAt">,
  asOfDate: string | Date,
  payments: PaymentLikeInterest[],
  disbursements?: DisbursementLike[],
  /** How many not-yet-due future cycles to include after the current one, for a forward-looking schedule view. 0 = past + due cycles only. */
  upcomingCount = 0
): MonthlyCycleStatus[] {
  if (loan.interestFrequency !== "MONTHLY") return [];
  const asOf = startOfDay(asOfDate);
  const anchorDate = parseDate(loan.startDate);
  const firstEventDate = effectiveDisbursements(loan, disbursements).reduce(
    (min, d) => (startOfDay(d.date) < min ? startOfDay(d.date) : min),
    startOfDay(loan.startDate)
  );

  // Walk a bit PAST `asOf` too (not just up to it) so upcoming, not-yet-due
  // cycles can be included — every one of these synthetic future periods
  // reports as "complete" relative to the extended walk, which is fine:
  // classification below compares each cycle's own end date against the
  // REAL asOf, not against this walk's endpoint.
  const periods = getPeriodBoundaries(firstEventDate, addMonths(asOf, upcomingCount + 2), "MONTHLY", anchorDate, FREQUENCY_DAYS.MONTHLY);
  if (!periods.length) return [];

  let prevWhole = 0;
  const cycles = periods.map((period) => {
    const whole = calculateInterestBreakdown(loan, period.end, payments, disbursements).whole;
    const cost = round2(whole - prevWhole);
    prevWhole = whole;
    return { start: period.start, end: period.end, cost };
  });

  const pool = payments
    .map((p) => ({ date: startOfDay(p.paymentDate), remaining: round2(Number(p.interestAmount) || 0) }))
    .filter((p) => p.remaining > 0.01)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const rows: MonthlyCycleStatus[] = [];
  let upcomingShown = 0;
  for (const cycle of cycles) {
    if (cycle.cost <= 0.01) continue; // nothing accrued this cycle (e.g. loan already fully repaid) — nothing to schedule
    let covered = 0;
    for (const p of pool) {
      if (covered >= cycle.cost - 0.01) break;
      if (p.remaining <= 0.01 || p.date < cycle.start) continue; // the fix: >= cycle.start, not >= cycle.end
      const take = Math.min(p.remaining, round2(cycle.cost - covered));
      covered = round2(covered + take);
      p.remaining = round2(p.remaining - take);
    }
    const isPaid = covered >= cycle.cost - 0.01;
    const daysSinceEnd = daysBetween(cycle.end, asOf);
    const status: MonthlyCycleStatus["status"] = isPaid
      ? "PAID"
      : daysSinceEnd > MONTHLY_INTEREST_GRACE_DAYS
        ? "OVERDUE"
        : cycle.end <= asOf
          ? "DUE"
          : "UPCOMING";
    if (status === "UPCOMING") {
      if (upcomingShown >= upcomingCount) break; // cycles only get later from here — nothing more to show
      upcomingShown++;
    }
    rows.push({ start: toISODate(cycle.start), end: toISODate(cycle.end), amount: cycle.cost, status });
  }
  return rows;
}

export function strictCycleGap(
  loan: Pick<Loan, "principal" | "startDate" | "interestRate" | "interestType" | "interestFrequency" | "status" | "cancelledAt" | "paidAt">,
  asOfDate: string | Date,
  payments: PaymentLikeInterest[],
  disbursements?: DisbursementLike[]
): StrictCycleGap {
  const rows = monthlyInterestSchedule(loan, asOfDate, payments, disbursements, 0);
  const unpaid = rows.filter((r) => r.status === "OVERDUE" || r.status === "DUE");
  if (!unpaid.length) return { amount: 0, sinceDate: null };
  return { amount: round2(unpaid.reduce((s, r) => s + r.amount, 0)), sinceDate: unpaid[0].end };
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

// How much of an OVERDUE loan actually counts as "overdue" — the WHOLE
// outstanding balance (principal included) once the loan's own final due
// date has passed, or just the unpaid whole-period interest before that
// (the loan's term isn't up yet, only a periodic cycle is late). Shared by
// the dashboard, reports, and the Overdue table so the three can never
// quietly drift apart the way three independent copies of this one rule
// eventually would.
export function overdueAmount(loan: Pick<Loan, "dueDate">, bal: LoanBalance, today: Date): number {
  return parseDate(loan.dueDate) < today ? bal.totalOutstanding : bal.interestPendingWhole;
}

// The "Overdue – Last N Months Interest" (or "This Month"/"Interest
// Pending") caption shown under a loan's pending-interest figure — shared
// by the Loans table, a customer's loan list, the Monthly Collection
// section, and the loan detail page so the four can't drift, and so a loan
// that isn't ACTUALLY flagged Overdue (most notably one that's PAID, since
// getLoanStatus's totalOutstanding<=1 check takes priority over the
// interestPendingWhole check) never shows this warning just because a
// strict per-cycle-matching quirk left a small residual gap in the
// lifetime numbers even though the loan is, in aggregate, settled.
//
// interestPerPeriod is computed from the CURRENT outstanding principal, so
// it shrinks toward zero as a loan is paid down — dividing a genuine (if
// small) pending amount by a near-zero denominator can produce a
// nonsensical month count (seen in practice on a nearly-fully-repaid loan:
// "Last 50506 Months Interest" for a ₹167 residual). Falls back to the
// generic message whenever the computed count isn't a sane, believable one.
export function pendingInterestCaption(status: LoanStatus, bal: Pick<LoanBalance, "interestPendingWhole" | "interestPerPeriod">): string | null {
  if (status !== "OVERDUE" || bal.interestPendingWhole <= 0.01) return null;
  if (bal.interestPerPeriod <= 0) return "Overdue – Interest Pending";
  const months = Math.round(bal.interestPendingWhole / bal.interestPerPeriod);
  if (!Number.isFinite(months) || months < 1 || months > 60) return "Overdue – Interest Pending";
  return months === 1 ? "Overdue – This Month Interest" : `Overdue – Last ${months} Months Interest`;
}

// "Completed" (not "Paid") for the terminal, fully-settled state — a
// single word that unambiguously means the whole loan is done, not "a
// payment was recorded." One label, used everywhere a loan's status is
// shown (customer page, loan list, loan detail, dashboard, overdue list,
// reports), so there is exactly one authoritative piece of text for this
// state — never a place that still says "Paid" while another says
// "Completed" for the same underlying status.
export const STATUS_LABEL: Record<LoanStatus, string> = {
  ACTIVE: "Active",
  PAID: "Completed",
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
  // Accrual anchors to the day the money actually changed hands — NOT
  // loan.collectionDay. The collection day is only when the lender goes
  // to collect (due-date display, Due Payments list, reminder cron); if
  // it also moved the accrual boundaries, overriding a loan started on
  // the 10th to "collect on the 15th" would re-carve its history into a
  // 5-day stub charged as a whole month, rewriting cycles the customer
  // has already settled.
  const anchorDate = parseDate(loan.startDate);
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

  const now =
    loan.status === "CANCELLED" && loan.cancelledAt
      ? startOfDay(loan.cancelledAt)
      : loan.status === "PAID" && loan.paidAt
        ? startOfDay(loan.paidAt)
        : startOfDay(asOfDate ?? businessNow());
  const firstDate = events.length ? events[0].date : startOfDay(loan.startDate);

  let principal = 0;
  let idx = 0;
  while (idx < events.length && events[idx].date <= firstDate) {
    principal = Math.max(0, principal + events[idx].delta);
    idx++;
  }

  // Same period-by-period walk as calculateInterestBreakdown: each period
  // gets its own row per balance that actually applied during it, so a
  // mid-period principal repayment or disbursement tranche shows up as two
  // (correctly smaller) rows instead of one row billing the whole period
  // at whichever balance was current once its boundary was finally reached.
  const periods = getPeriodBoundaries(firstDate, now, loan.interestFrequency, anchorDate, periodDays);
  for (const period of periods) {
    let segStart = period.start;
    const emit = (end: Date, event: string) => {
      const days = daysBetween(segStart, end);
      if (days > 0 && principal > 0) {
        const periodsFraction = round2(days / period.length);
        const interest = loan.interestType === "FIXED" ? rate * (days / period.length) : (principal * rate * (days / period.length)) / 100;
        segments.push({ from: toISODate(segStart), to: toISODate(end), days, periods: periodsFraction, principal, interest: round2(interest), event });
      }
      segStart = end;
    };
    while (idx < events.length && events[idx].date <= period.end && events[idx].date > segStart) {
      emit(events[idx].date, events[idx].label);
      principal = Math.max(0, principal + events[idx].delta);
      idx++;
    }
    emit(period.end, period.complete ? "Period completed" : "Current period accruing (not yet complete)");
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
      s.overdueAmount += overdueAmount(loan, b, t0);
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
