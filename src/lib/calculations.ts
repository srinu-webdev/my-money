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
//     monthly=30d, yearly=365d. Partial periods accrue pro-rata, by
//     whole calendar day.
//   • Accrual stops once the outstanding principal reaches zero, or the
//     loan is cancelled (accrual is capped at `cancelledAt`).
//   • Interest is never negative.
// =====================================================================
import { daysBetween, parseDate, startOfDay } from "./dates";
import type {
  AllocationMode,
  CustomerSummary,
  DashboardStats,
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
function sum<T>(arr: T[], fn: (x: T) => number): number {
  return arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0);
}

export function calculateInterestForLoan(
  loan: Pick<Loan, "principal" | "startDate" | "interestRate" | "interestType" | "interestFrequency" | "status" | "cancelledAt">,
  asOfDate: string | Date,
  payments: Pick<Payment, "paymentDate" | "principalAmount">[]
): number {
  let asOf = startOfDay(asOfDate);
  if (loan.status === "CANCELLED" && loan.cancelledAt) {
    const c = startOfDay(loan.cancelledAt);
    if (c < asOf) asOf = c; // accrual stops at cancellation
  }
  const start = startOfDay(loan.startDate);
  if (asOf <= start) return 0;

  const rate = Number(loan.interestRate) || 0;
  const periodDays = FREQUENCY_DAYS[loan.interestFrequency] || 30;
  const sorted = [...payments].sort(
    (a, b) => parseDate(a.paymentDate).getTime() - parseDate(b.paymentDate).getTime()
  );

  let segStart = start;
  let bal = Number(loan.principal) || 0;
  let interest = 0;
  const accrueSegment = (segEnd: Date) => {
    if (segEnd <= segStart || bal <= 0) return;
    const periods = daysBetween(segStart, segEnd) / periodDays;
    interest += loan.interestType === "FIXED" ? rate * periods : bal * (rate / 100) * periods;
  };
  for (const p of sorted) {
    const pDate = startOfDay(p.paymentDate);
    const principalPortion = Number(p.principalAmount) || 0;
    if (pDate <= segStart) {
      bal = Math.max(0, bal - principalPortion);
      continue;
    }
    if (pDate >= asOf) break;
    accrueSegment(pDate);
    bal = Math.max(0, bal - principalPortion);
    segStart = pDate;
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

export function calculateLoanBalance(loan: Loan, payments: Payment[], asOfDate?: string | Date): LoanBalance {
  const principal = Number(loan.principal) || 0;
  const principalPaid = round2(sum(payments, (p) => p.principalAmount));
  const interestPaid = round2(sum(payments, (p) => p.interestAmount));
  const principalRemaining = Math.max(0, round2(principal - principalPaid));
  const interestAccrued = calculateInterestForLoan(loan, asOfDate ?? new Date(), payments);
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
  asOfDate?: string
): { interestAmount: number; principalAmount: number; interestRemaining: number; principalRemaining: number; unallocated: number } {
  const principalPaid = sum(existingPayments, (p) => p.principalAmount);
  const interestPaid = sum(existingPayments, (p) => p.interestAmount);
  const principalRemaining = Math.max(0, (Number(loan.principal) || 0) - principalPaid);
  const interestRemaining = Math.max(
    0,
    calculateInterestForLoan(loan, asOfDate ?? new Date(), existingPayments) - interestPaid
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

/** Segment-by-segment breakdown of how the accrued interest was computed — for the loan detail page's "Interest Breakdown" tab. */
export function getLoanSchedule(loan: Loan, payments: Payment[], asOfDate?: string | Date): LoanScheduleSegment[] {
  const sorted = [...payments].sort((a, b) => parseDate(a.paymentDate).getTime() - parseDate(b.paymentDate).getTime());
  const periodDays = FREQUENCY_DAYS[loan.interestFrequency] || 30;
  const rate = Number(loan.interestRate) || 0;
  const segments: LoanScheduleSegment[] = [];
  let segStart = startOfDay(loan.startDate);
  let principal = Number(loan.principal) || 0;
  const now = loan.status === "CANCELLED" && loan.cancelledAt ? startOfDay(loan.cancelledAt) : startOfDay(asOfDate ?? new Date());

  const push = (end: Date, event: string) => {
    if (end <= segStart || principal <= 0) return;
    const days = daysBetween(segStart, end);
    const periods = days / periodDays;
    const interest = loan.interestType === "FIXED" ? rate * periods : (principal * rate * periods) / 100;
    segments.push({ from: segStart.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), days, periods, principal, interest: round2(interest), event });
  };

  for (const p of sorted) {
    const pDate = startOfDay(p.paymentDate);
    if (pDate <= segStart) {
      principal = Math.max(0, principal - p.principalAmount);
      continue;
    }
    if (pDate > now) break;
    push(pDate, `Payment ${p.id}: −${formatCurrencyPlain(p.principalAmount)} principal`);
    principal = Math.max(0, principal - p.principalAmount);
    segStart = pDate;
  }
  push(now, "Accruing (today)");
  return segments;
}

function formatCurrencyPlain(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function calculateCustomerSummary(loans: Loan[], paymentsByLoan: Map<string, Payment[]>): CustomerSummary {
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
  };
  for (const loan of loans) {
    const payments = paymentsByLoan.get(loan.id) ?? [];
    const b = calculateLoanBalance(loan, payments);
    const st = getLoanStatus(loan, b);
    if (st === "CANCELLED") {
      s.principalPaid += b.principalPaid;
      s.interestPaid += b.interestPaid;
      continue;
    }
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

export function getDashboardStats(loans: Loan[], payments: Payment[], customerCount: number, todayStr: string): DashboardStats {
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
    const b = calculateLoanBalance(loan, paymentsByLoan.get(loan.id) ?? []);
    const st = getLoanStatus(loan, b);
    s.totalMoneyLent += b.principal;
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
