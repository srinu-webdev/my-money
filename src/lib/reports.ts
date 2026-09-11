import { addDays, businessNow, parseDate, startOfDay } from "./dates";
import { calculateLoanBalance, getLoanStatus } from "./calculations";
import type { Customer, Disbursement, Loan, Payment } from "./types";

export type ReportRangeKey = "today" | "7d" | "30d" | "this-month" | "last-month" | "this-year" | "all" | "custom";

export interface ReportRange {
  from: Date;
  to: Date; // exclusive
  label: string;
}

export function reportRange(key: ReportRangeKey, customFrom?: string, customTo?: string): ReportRange {
  const now = businessNow();
  const t0 = startOfDay(now);
  switch (key) {
    case "today":
      return { from: t0, to: addDays(t0, 1), label: "Today" };
    case "7d":
      return { from: addDays(t0, -6), to: addDays(t0, 1), label: "Last 7 Days" };
    case "30d":
      return { from: addDays(t0, -29), to: addDays(t0, 1), label: "Last 30 Days" };
    case "last-month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to, label: "Last Month" };
    }
    case "this-year":
      return { from: new Date(now.getFullYear(), 0, 1), to: addDays(t0, 1), label: "This Year" };
    case "all":
      return { from: new Date(2000, 0, 1), to: addDays(t0, 1), label: "All Time" };
    case "custom": {
      const from = customFrom ? startOfDay(customFrom) : addDays(t0, -29);
      const to = customTo ? addDays(startOfDay(customTo), 1) : addDays(t0, 1);
      return { from, to, label: `${from.toLocaleDateString("en-IN")} – ${addDays(to, -1).toLocaleDateString("en-IN")}` };
    }
    default:
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: addDays(t0, 1), label: "This Month" };
  }
}

export function inRange(d: string, r: ReportRange): boolean {
  const x = parseDate(d);
  return x >= r.from && x < r.to;
}

// The equal-length window immediately before `range` — the fair basis for
// a "vs last period" comparison regardless of which range key is active
// (Last 30 Days compares to the 30 days before that, This Year to the same
// span of last year's data, etc.).
export function previousPeriodRange(range: ReportRange): ReportRange {
  const spanMs = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - spanMs), to: range.from, label: "Previous period" };
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // null = "no baseline", render as "New" rather than a fake percentage
  return ((current - previous) / previous) * 100;
}

export interface ReportData {
  range: ReportRange;
  lent: number;
  lentCount: number;
  principalCollected: number;
  interestCollected: number;
  totalCollected: number;
  paymentsCount: number;
  newCustomers: number;
  interestPending: number;
  principalOutstanding: number;
  outstanding: number;
  overdue: number;
  overdueCount: number;
  lentLoans: Loan[];
  periodPayments: Payment[];
}

export function computeReport(loans: Loan[], payments: Payment[], customers: Customer[], range: ReportRange, disbursements: Disbursement[] = []): ReportData {
  const active = loans.filter((l) => l.status !== "CANCELLED");
  const lentLoans = active.filter((l) => inRange(l.startDate, range));
  const periodPayments = payments.filter((p) => inRange(p.paymentDate, range));
  const newCustomers = customers.filter((c) => inRange(c.createdAt, range)).length;

  const paymentsByLoan = new Map<string, Payment[]>();
  for (const p of payments) {
    const arr = paymentsByLoan.get(p.loanId) ?? [];
    arr.push(p);
    paymentsByLoan.set(p.loanId, arr);
  }
  const disbursementsByLoan = new Map<string, Disbursement[]>();
  for (const d of disbursements) {
    const arr = disbursementsByLoan.get(d.loanId) ?? [];
    arr.push(d);
    disbursementsByLoan.set(d.loanId, arr);
  }
  let interestPending = 0;
  let principalOutstanding = 0;
  let overdue = 0;
  let overdueCount = 0;
  for (const l of active) {
    const bal = calculateLoanBalance(l, paymentsByLoan.get(l.id) ?? [], undefined, disbursementsByLoan.get(l.id));
    const st = getLoanStatus(l, bal);
    interestPending += bal.interestRemaining;
    principalOutstanding += bal.principalRemaining;
    if (st === "OVERDUE") {
      // What's actually overdue depends on WHY this loan is flagged that
      // way (mirrors getLoanStatus's own check order): once the loan's own
      // final due date has passed, the whole remaining balance — principal
      // included — is now due. Before that, the loan's term itself isn't
      // up yet; only a missed periodic interest cycle is late, so the
      // principal isn't part of what's overdue.
      overdue += parseDate(l.dueDate) < businessNow() ? bal.totalOutstanding : bal.interestPendingWhole;
      overdueCount++;
    }
  }

  // "Money lent" in this period is actual cash handed over — every
  // disbursement (initial or a later tranche) whose date falls in range,
  // not just loans that were first created in range. A loan created last
  // month with a second tranche given out this month correctly counts
  // that tranche as lent this month.
  const lentInRange = disbursements.length
    ? disbursements.filter((d) => active.some((l) => l.id === d.loanId) && inRange(d.date, range))
    : lentLoans.map((l) => ({ amount: l.principal, loanId: l.id }));

  return {
    range,
    lent: lentInRange.reduce((s, d) => s + d.amount, 0),
    lentCount: lentLoans.length,
    principalCollected: periodPayments.reduce((s, p) => s + p.principalAmount, 0),
    interestCollected: periodPayments.reduce((s, p) => s + p.interestAmount, 0),
    totalCollected: periodPayments.reduce((s, p) => s + p.amount, 0),
    paymentsCount: periodPayments.length,
    newCustomers,
    interestPending,
    principalOutstanding,
    outstanding: interestPending + principalOutstanding,
    overdue,
    overdueCount,
    lentLoans,
    periodPayments,
  };
}
