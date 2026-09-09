import { addDays, parseDate, startOfDay } from "./dates";
import { calculateLoanBalance, getLoanStatus } from "./calculations";
import type { Customer, Loan, Payment } from "./types";

export type ReportRangeKey = "today" | "7d" | "30d" | "this-month" | "last-month" | "this-year" | "all" | "custom";

export interface ReportRange {
  from: Date;
  to: Date; // exclusive
  label: string;
}

export function reportRange(key: ReportRangeKey, customFrom?: string, customTo?: string): ReportRange {
  const now = new Date();
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

export function computeReport(loans: Loan[], payments: Payment[], customers: Customer[], range: ReportRange): ReportData {
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
  let interestPending = 0;
  let principalOutstanding = 0;
  let overdue = 0;
  let overdueCount = 0;
  for (const l of active) {
    const bal = calculateLoanBalance(l, paymentsByLoan.get(l.id) ?? []);
    const st = getLoanStatus(l, bal);
    interestPending += bal.interestRemaining;
    principalOutstanding += bal.principalRemaining;
    if (st === "OVERDUE") {
      overdue += bal.totalOutstanding;
      overdueCount++;
    }
  }

  return {
    range,
    lent: lentLoans.reduce((s, l) => s + l.principal, 0),
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
