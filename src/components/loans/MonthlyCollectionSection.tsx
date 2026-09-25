"use client";

import Link from "next/link";
import { CalendarClock } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Table, TableWrap, Th, Td } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { usePaymentFormModal } from "@/components/payments/PaymentFormModal";
import { SendReminderButton } from "@/components/loans/ReminderFormModal";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import { pendingInterestCaption } from "@/lib/calculations";
import type { LoanRow } from "@/lib/queries";
import type { Customer } from "@/lib/types";

// Every "Interest Only"-style loan has a natural monthly collection day —
// the day-of-month it started on (a loan given on the 10th is collected
// on the 10th every month after). This is a scheduling aid, separate from
// the loan's own final due date (its maturity date, shown elsewhere) —
// it's about which day of THIS month to go collect from whom.
export interface MonthlyDueItem {
  loan: LoanRow;
  nextDueDate: string; // ISO date of the next occurrence of the collection day
  daysUntil: number; // 0 = today, negative not used (wraps to next month)
}

export function MonthlyCollectionSection({ items, customers }: { items: MonthlyDueItem[]; customers: Map<string, Customer> }) {
  const recordPayment = usePaymentFormModal();
  if (!items.length) return null;

  // interestPendingWholeRaw (not the grace-gated interestPendingWhole) —
  // a period that's genuinely unpaid but still inside its 5-day grace
  // window must still show up HERE, on the "who to go collect from"
  // list, even though it doesn't get flagged Overdue yet elsewhere.
  // Bucketing it under "overdue" is still correct: nextMonthlyCollectionDate
  // would report it weeks away (it always looks forward to the FOLLOWING
  // cycle), so it could never land in dueToday/upcoming on its own.
  const overdue = items.filter((i) => i.loan.balance.interestPendingWholeRaw > 0.01);
  const dueToday = items.filter((i) => i.loan.balance.interestPendingWholeRaw <= 0.01 && i.daysUntil === 0);
  const upcoming = items
    .filter((i) => i.loan.balance.interestPendingWholeRaw <= 0.01 && i.daysUntil > 0 && i.daysUntil <= 5)
    .sort((a, b) => a.daysUntil - b.daysUntil);
  const rows = [...overdue, ...dueToday, ...upcoming];
  if (!rows.length) return null;

  return (
    <Card className="mb-5">
      <div className="flex items-center gap-3 px-4 sm:px-[22px] py-[18px] border-b border-border flex-wrap">
        <CalendarClock className="w-6 h-6 shrink-0 text-primary-600" />
        <div>
          <h3 className="text-[15px] font-bold flex items-center gap-2">
            {/* Badge's own base class sets px-2.5 — a className override can't
                win that (cn() is plain clsx, no Tailwind conflict resolution),
                so the tighter count-pill padding needs an inline style. */}
            Monthly Interest Collection <Badge tone="primary" plain style={{ paddingLeft: "8px", paddingRight: "8px" }}>{rows.length}</Badge>
          </h3>
          <div className="text-[12.5px] text-text-secondary">Who to collect this recurring monthly interest from, and when — separate from a loan&rsquo;s final due date.</div>
        </div>
      </div>
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th className="hidden sm:table-cell">Phone</Th>
              <Th className="hidden md:table-cell">Loan ID</Th>
              <Th className="hidden sm:table-cell">Next Due</Th>
              <Th className="text-right">Amount</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ loan: l, nextDueDate, daysUntil }) => {
              const c = customers.get(l.customerId);
              // Past its grace period, interestPendingWhole and the raw
              // figure are the same value anyway; during grace only the raw
              // one is nonzero. Preferring the gated one when it's set keeps
              // this identical to before for every already-overdue loan.
              const pendingWhole = l.balance.interestPendingWhole > 0.01 ? l.balance.interestPendingWhole : l.balance.interestPendingWholeRaw;
              const inGrace = l.balance.interestPendingWhole <= 0.01 && l.balance.interestPendingWholeRaw > 0.01;
              // Shared with the Loans table, customer loan list, and loan
              // detail page — see pendingInterestCaption's own comment for
              // why this must never show for a loan that isn't genuinely
              // flagged Overdue (e.g. one that's PAID in aggregate despite a
              // small strict-per-cycle-matching residual).
              const overdueCaption = pendingInterestCaption(l.derivedStatus, l.balance);
              return (
                <tr key={l.id} className={pendingWhole > 0.01 ? (inGrace ? "bg-warning-light/30" : "bg-danger-light/30") : daysUntil === 0 ? "bg-warning-light/30" : "hover:bg-surface-2"}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar name={c?.name ?? "?"} size="sm" />
                      <Link href={`/customers/${l.customerId}`} className="font-semibold text-primary hover:underline">
                        {c?.name}
                      </Link>
                    </div>
                  </Td>
                  <Td className="hidden sm:table-cell">{c?.phone}</Td>
                  <Td className="hidden md:table-cell">
                    <Link href={`/loans/${l.id}`} className="text-primary font-mono hover:underline">
                      {l.id}
                    </Link>
                  </Td>
                  <Td className="hidden sm:table-cell text-text-secondary">{inGrace ? formatDate(l.balance.currentPeriodStart) : formatDate(nextDueDate)}</Td>
                  <Td className="text-right font-bold mono-nums">{formatCurrency(pendingWhole > 0.01 ? pendingWhole : l.balance.interestPerPeriod)}</Td>
                  <Td className={pendingWhole > 0.01 ? (inGrace ? "text-warning-dark font-semibold" : "text-danger font-semibold") : daysUntil === 0 ? "text-warning-dark font-semibold" : "text-text-secondary"}>
                    {inGrace ? (
                      <>
                        Due {formatDate(l.balance.currentPeriodStart)}
                        <div className="text-xs font-normal text-text-tertiary">Not yet flagged overdue</div>
                      </>
                    ) : overdueCaption ? (
                      <>
                        {overdueCaption}
                        <div className="text-xs font-normal text-text-tertiary">
                          <StatusBadge status={l.derivedStatus} />
                        </div>
                      </>
                    ) : daysUntil === 0 ? (
                      "Due today"
                    ) : (
                      `In ${daysUntil} day${daysUntil === 1 ? "" : "s"}`
                    )}
                  </Td>
                  <Td>
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => recordPayment({ loanId: l.id })}>
                        Record Payment
                      </Button>
                      <SendReminderButton loanId={l.id} variant="secondary" iconOnly />
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrap>
    </Card>
  );
}
