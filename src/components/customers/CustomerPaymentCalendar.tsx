"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { startOfMonth, endOfMonth, eachDayOfInterval, getDay, subDays, addDays as fnsAddDays, isSameMonth } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays } from "@/components/ui/icons";
import { formatCurrency } from "@/lib/format";
import { toISODate, addMonths, formatDate, businessNow } from "@/lib/dates";
import type { LoanRow } from "@/lib/queries";
import type { Payment } from "@/lib/types";

// Day-by-day view of a customer's payment history, built specifically for
// Daily Installment loans — for every day between a daily loan's start and
// today (or when it closed), a payment is EXPECTED, so a day with nothing
// recorded is flagged "Missed" rather than just silently absent from a
// list. Loans on other repayment schedules (monthly interest, etc.) don't
// have a daily expectation, so they only ever contribute green "paid" days
// here, never a red "missed" one.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DayCell {
  date: Date;
  iso: string;
  inMonth: boolean;
  isToday: boolean;
  paidAmount: number;
  expectedLoanIds: string[];
}

function loanExpectedThrough(loan: LoanRow, todayIso: string): string {
  // A daily loan that's already fully paid off stops expecting further
  // daily payments after whichever day actually closed it — not every day
  // up to the due date, and not forever into the future either.
  if (loan.derivedStatus === "PAID" && loan.balance.lastPaymentDate) return loan.balance.lastPaymentDate;
  return todayIso < loan.dueDate ? todayIso : loan.dueDate;
}

export function CustomerPaymentCalendar({ loans, payments }: { loans: LoanRow[]; payments: Payment[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  // businessNow(), not new Date() — this drives which days get flagged
  // "Missed" for a daily loan, so it needs to agree with the same business
  // calendar day the server used to compute every other status on the
  // page, not whatever timezone this browser happens to be in.
  const todayIso = toISODate(businessNow());
  const base = useMemo(() => addMonths(businessNow(), monthOffset), [monthOffset]);

  const dailyLoans = useMemo(() => loans.filter((l) => l.repaymentType === "Daily Installment" && l.status !== "CANCELLED"), [loans]);

  const paymentsByDay = useMemo(() => {
    const m = new Map<string, Payment[]>();
    for (const p of payments) {
      const arr = m.get(p.paymentDate) ?? [];
      arr.push(p);
      m.set(p.paymentDate, arr);
    }
    return m;
  }, [payments]);

  const weeks = useMemo(() => {
    const monthStart = startOfMonth(base);
    const monthEnd = endOfMonth(base);
    const gridStart = subDays(monthStart, getDay(monthStart));
    const gridEnd = fnsAddDays(monthEnd, 6 - getDay(monthEnd));
    const days: DayCell[] = eachDayOfInterval({ start: gridStart, end: gridEnd }).map((date) => {
      const iso = toISODate(date);
      const dayPayments = paymentsByDay.get(iso) ?? [];
      // Only a day that's fully over can be "missed" — today still has
      // hours left to collect in, so it never turns red while it's
      // still today, only tomorrow if nothing came in.
      const isPast = iso < todayIso;
      const expectedLoanIds = isPast
        ? dailyLoans.filter((l) => iso >= l.startDate && iso <= loanExpectedThrough(l, todayIso)).map((l) => l.id)
        : [];
      return {
        date,
        iso,
        inMonth: isSameMonth(date, base),
        isToday: iso === todayIso,
        paidAmount: dayPayments.reduce((s, p) => s + p.amount, 0),
        expectedLoanIds,
      };
    });
    const rows: DayCell[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [base, paymentsByDay, dailyLoans, todayIso]);

  const monthLabel = base.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="p-4 sm:p-[22px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-text-tertiary" /> {monthLabel}
        </h3>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMonthOffset((m) => m - 1)} className="p-1.5 rounded-md hover:bg-surface-2 text-text-secondary" title="Previous month">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setMonthOffset(0)} className="text-xs font-semibold text-primary hover:underline px-1.5" disabled={monthOffset === 0}>
            Today
          </button>
          <button type="button" onClick={() => setMonthOffset((m) => m + 1)} className="p-1.5 rounded-md hover:bg-surface-2 text-text-secondary" title="Next month">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {dailyLoans.length === 0 ? (
        <div className="bg-info-light text-info-dark dark:text-sky-300 rounded-[10px] px-3.5 py-2.5 text-[13px] mb-4">
          This customer has no Daily Installment loan, so days aren&rsquo;t marked missed — the calendar below only shows which days a payment was actually recorded.
        </div>
      ) : null}

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[10px] sm:text-[11px] font-semibold text-text-tertiary py-1">
            {/* Full weekday name only where there's room for it — at
                7-across on a phone it wraps ("Wed" -> "We\nd") long
                before it truncates. */}
            <span className="sm:hidden">{w[0]}</span>
            <span className="hidden sm:inline">{w}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1 sm:gap-1.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {week.map((d) => {
              const paid = d.paidAmount > 0;
              const missed = !paid && d.expectedLoanIds.length > 0;
              return (
                <div
                  key={d.iso}
                  title={
                    paid
                      ? `${formatDate(d.iso)} — ${formatCurrency(d.paidAmount)} paid`
                      : missed
                        ? `${formatDate(d.iso)} — payment expected, none recorded`
                        : formatDate(d.iso)
                  }
                  className={`relative rounded-lg px-1 py-1 sm:px-1.5 sm:py-1.5 min-h-[34px] sm:min-h-[52px] text-[10px] sm:text-[11px] border ${
                    !d.inMonth
                      ? "border-transparent opacity-30"
                      : paid
                        ? "bg-success-light border-success-light"
                        : missed
                          ? "bg-danger-light border-danger-light"
                          : "bg-surface-2 border-border"
                  } ${d.isToday ? "ring-2 ring-primary ring-offset-1 ring-offset-surface" : ""}`}
                >
                  <div className={`font-semibold ${d.isToday ? "text-primary" : "text-text-secondary"}`}>{d.date.getDate()}</div>
                  {/* The amount / "Missed" label only fit a 7-column grid
                      from `sm:` up — below that the cell's own color
                      (green/red/gray) plus the legend and the `title`
                      tooltip already carry the meaning, so mobile just
                      shows the date number. */}
                  {paid ? <div className="hidden sm:block text-success-dark font-bold leading-tight mt-0.5">{formatCurrency(d.paidAmount)}</div> : null}
                  {missed ? <div className="hidden sm:block text-danger-dark font-semibold leading-tight mt-0.5">Missed</div> : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 mt-4 text-[12px] text-text-secondary flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-success-light border border-success-light inline-block" /> Paid
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-danger-light border border-danger-light inline-block" /> Missed (Daily Installment day with no payment)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-surface-2 border border-border inline-block" /> No payment expected
        </span>
      </div>

      {dailyLoans.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {dailyLoans.map((l) => (
            <Link key={l.id} href={`/loans/${l.id}`} className="text-xs font-mono text-primary hover:underline bg-primary-50 px-2 py-1 rounded-md">
              {l.id} · Daily Installment
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
