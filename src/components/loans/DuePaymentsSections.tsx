"use client";

import Link from "next/link";
import { Calendar, CheckCircle, Clock, TrendingUp, Wallet } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Table, TableWrap, Th, Td } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { AddPaymentIconButton, usePaymentFormModal } from "@/components/payments/PaymentFormModal";
import { SendReminderButton } from "@/components/loans/ReminderFormModal";
import { MonthlyCollectionSection, type MonthlyDueItem } from "@/components/loans/MonthlyCollectionSection";
import { formatCurrency } from "@/lib/format";
import { businessNow, formatDate } from "@/lib/dates";
import type { LoanRow } from "@/lib/queries";
import type { Customer } from "@/lib/types";

export interface DueItem {
  loan: LoanRow;
  label: string;
}

function Section({ title, sub, items, tone, icon: Icon, customers }: { title: string; sub: string; items: DueItem[]; tone: "danger" | "warning" | "primary"; icon: typeof Calendar; customers: Map<string, Customer> }) {
  const recordPayment = usePaymentFormModal();
  const total = items.reduce((s, x) => s + x.loan.balance.totalOutstanding, 0);
  // Section's tone values ("danger" | "warning" | "primary") are already a
  // subset of Badge's own Tone type, so it doubles as the badge tone directly.
  const toneText = { danger: "text-danger", warning: "text-warning-dark", primary: "text-primary-600" }[tone];

  // Nothing due in this bucket — the stat cards above already show "0
  // loans" for it, so a whole extra card whose only content is "Nothing
  // here" is pure clutter, not information. Skip rendering it entirely.
  if (!items.length) return null;

  return (
    <Card className="mb-5">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-[22px] py-[18px] border-b border-border flex-wrap">
        <div className="flex items-center gap-3">
          <Icon className={`w-6 h-6 shrink-0 ${toneText}`} />
          <div>
            <h3 className="text-[15px] font-bold flex items-center gap-2">
              {/* Badge's own base class sets px-2.5 — a className override can't
                  win that (cn() is plain clsx, no Tailwind conflict resolution),
                  so the tighter count-pill padding needs an inline style. */}
              {title} <Badge tone={tone} plain style={{ paddingLeft: "8px", paddingRight: "8px" }}>{items.length}</Badge>
            </h3>
            <div className="text-[12.5px] text-text-secondary">{sub}</div>
          </div>
        </div>
        <div className="font-bold">{formatCurrency(total)}</div>
      </div>
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th className="hidden sm:table-cell">Phone</Th>
              <Th className="hidden md:table-cell">Loan ID</Th>
              <Th className="text-right">Amount Due</Th>
              <Th className="hidden lg:table-cell text-right">Interest Due</Th>
              <Th className="hidden lg:table-cell text-right">Principal Due</Th>
              <Th className="hidden md:table-cell">Due Date</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {items.map(({ loan: l, label }) => {
              const c = customers.get(l.customerId);
              return (
              <tr key={l.id} className={tone === "danger" ? "bg-danger-light/30" : "hover:bg-surface-2"}>
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
                <Td className="text-right font-bold mono-nums">{formatCurrency(l.balance.totalOutstanding)}</Td>
                <Td className="hidden lg:table-cell text-right mono-nums">{formatCurrency(l.balance.interestRemaining)}</Td>
                <Td className="hidden lg:table-cell text-right mono-nums">{formatCurrency(l.balance.principalRemaining)}</Td>
                <Td className={`hidden md:table-cell ${tone === "danger" ? "text-danger font-semibold" : tone === "warning" ? "text-warning-dark font-semibold" : "text-text-secondary"}`}>
                  {formatDate(l.dueDate)}
                  <div className="text-xs font-normal text-text-tertiary">{label}</div>
                </Td>
                <Td>
                  <StatusBadge status={l.derivedStatus} />
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

export function DuePaymentsSections({
  today,
  tomorrow,
  upcoming,
  monthly,
  customers,
}: {
  today: DueItem[];
  tomorrow: DueItem[];
  upcoming: DueItem[];
  monthly: MonthlyDueItem[];
  customers: Map<string, Customer>;
}) {
  const sum = (items: DueItem[]) => items.reduce((s, x) => s + x.loan.balance.totalOutstanding, 0);
  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Due Payments</h1>
          <p className="text-text-secondary text-[13.5px] mt-0.5">Collections falling due today, tomorrow and over the next 30 days.</p>
        </div>
        <AddPaymentIconButton />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Due Today" value={formatCurrency(sum(today))} icon={Calendar} tone="danger" hint={`${today.length} loan${today.length === 1 ? "" : "s"}`} />
        <StatCard label="Due Tomorrow" value={formatCurrency(sum(tomorrow))} icon={Clock} tone="warning" hint={`${tomorrow.length} loan${tomorrow.length === 1 ? "" : "s"}`} />
        <StatCard label="Upcoming (30 days)" value={formatCurrency(sum(upcoming))} icon={TrendingUp} tone="primary" hint={`${upcoming.length} loan${upcoming.length === 1 ? "" : "s"}`} />
        <StatCard label="Total Due" value={formatCurrency(sum(today) + sum(tomorrow) + sum(upcoming))} icon={Wallet} tone="info" />
      </div>
      <MonthlyCollectionSection items={monthly} customers={customers} />
      <Section title="Due Today" sub={formatDate(businessNow())} items={today} tone="danger" icon={Calendar} customers={customers} />
      <Section title="Due Tomorrow" sub="Next day" items={tomorrow} tone="warning" icon={Clock} customers={customers} />
      <Section title="Upcoming" sub="Next 30 days" items={upcoming} tone="primary" icon={TrendingUp} customers={customers} />
      {!monthly.length && !today.length && !tomorrow.length && !upcoming.length ? (
        <Card>
          <EmptyState icon={CheckCircle} title="Nothing due" text="No collections due today, tomorrow, or in the next 30 days." />
        </Card>
      ) : null}
    </div>
  );
}
