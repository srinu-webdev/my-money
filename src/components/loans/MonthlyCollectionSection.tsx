"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Table, TableWrap, Th, Td } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { usePaymentFormModal } from "@/components/payments/PaymentFormModal";
import { SendReminderButton } from "@/components/loans/ReminderFormModal";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/dates";
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

  const overdue = items.filter((i) => i.loan.balance.interestPendingWhole > 0.01);
  const dueToday = items.filter((i) => i.loan.balance.interestPendingWhole <= 0.01 && i.daysUntil === 0);
  const upcoming = items
    .filter((i) => i.loan.balance.interestPendingWhole <= 0.01 && i.daysUntil > 0 && i.daysUntil <= 5)
    .sort((a, b) => a.daysUntil - b.daysUntil);
  const rows = [...overdue, ...dueToday, ...upcoming];
  if (!rows.length) return null;

  return (
    <Card className="mb-5">
      <div className="flex items-center gap-3 px-4 sm:px-[22px] py-[18px] border-b border-border flex-wrap">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary-50 text-primary-600">
          <CalendarClock className="w-[18px] h-[18px]" />
        </span>
        <div>
          <h3 className="text-[15px] font-bold flex items-center gap-2">
            Monthly Interest Collection <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-50 text-primary-600">{rows.length}</span>
          </h3>
          <div className="text-[12.5px] text-text-secondary">Who to collect this recurring monthly interest from, and when — separate from a loan&rsquo;s final due date.</div>
        </div>
      </div>
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th>Phone</Th>
              <Th>Loan ID</Th>
              <Th>Next Due</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ loan: l, nextDueDate, daysUntil }) => {
              const c = customers.get(l.customerId);
              const pendingWhole = l.balance.interestPendingWhole;
              const overdueMonths = Math.round(pendingWhole / (l.balance.interestPerPeriod || pendingWhole || 1));
              return (
                <tr key={l.id} className={pendingWhole > 0.01 ? "bg-danger-light/30" : daysUntil === 0 ? "bg-warning-light/30" : "hover:bg-surface-2"}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar name={c?.name ?? "?"} size="sm" />
                      <Link href={`/customers/${l.customerId}`} className="font-semibold text-primary hover:underline">
                        {c?.name}
                      </Link>
                    </div>
                  </Td>
                  <Td>{c?.phone}</Td>
                  <Td>
                    <Link href={`/loans/${l.id}`} className="text-primary font-mono hover:underline">
                      {l.id}
                    </Link>
                  </Td>
                  <Td className="text-text-secondary">{formatDate(nextDueDate)}</Td>
                  <Td className="font-bold">{formatCurrency(pendingWhole > 0.01 ? pendingWhole : l.balance.interestPerPeriod)}</Td>
                  <Td className={pendingWhole > 0.01 ? "text-danger font-semibold" : daysUntil === 0 ? "text-warning-dark font-semibold" : "text-text-secondary"}>
                    {pendingWhole > 0.01 ? (
                      <>
                        {overdueMonths} month{overdueMonths === 1 ? "" : "s"} overdue
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
