"use client";

import Link from "next/link";
import { Calendar, Clock, TrendingUp, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/Badge";
import { Table, TableWrap, Th, Td } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { AddPaymentIconButton, usePaymentFormModal } from "@/components/payments/PaymentFormModal";
import { SendReminderButton } from "@/components/loans/ReminderFormModal";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import type { LoanRow } from "@/lib/queries";
import type { Customer } from "@/lib/types";

export interface DueItem {
  loan: LoanRow;
  label: string;
}

function Section({ title, sub, items, tone, icon: Icon, customers }: { title: string; sub: string; items: DueItem[]; tone: "danger" | "warning" | "primary"; icon: typeof Calendar; customers: Map<string, Customer> }) {
  const recordPayment = usePaymentFormModal();
  const total = items.reduce((s, x) => s + x.loan.balance.totalOutstanding, 0);
  const toneClass = { danger: "bg-danger-light text-danger", warning: "bg-warning-light text-warning-dark", primary: "bg-primary-50 text-primary-600" }[tone];

  return (
    <Card className="mb-5">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-[22px] py-[18px] border-b border-border flex-wrap">
        <div className="flex items-center gap-3">
          <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${toneClass}`}>
            <Icon className="w-[18px] h-[18px]" />
          </span>
          <div>
            <h3 className="text-[15px] font-bold flex items-center gap-2">
              {title} <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${toneClass}`}>{items.length}</span>
            </h3>
            <div className="text-[12.5px] text-text-secondary">{sub}</div>
          </div>
        </div>
        <div className="font-bold">{formatCurrency(total)}</div>
      </div>
      {items.length ? (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Phone</Th>
                <Th>Loan ID</Th>
                <Th>Amount Due</Th>
                <Th>Interest Due</Th>
                <Th>Principal Due</Th>
                <Th>Due Date</Th>
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
                  <Td>{c?.phone}</Td>
                  <Td>
                    <Link href={`/loans/${l.id}`} className="text-primary font-mono hover:underline">
                      {l.id}
                    </Link>
                  </Td>
                  <Td className="font-bold">{formatCurrency(l.balance.totalOutstanding)}</Td>
                  <Td>{formatCurrency(l.balance.interestRemaining)}</Td>
                  <Td>{formatCurrency(l.balance.principalRemaining)}</Td>
                  <Td className={tone === "danger" ? "text-danger font-semibold" : tone === "warning" ? "text-warning-dark font-semibold" : "text-text-secondary"}>
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
      ) : (
        <div className="p-6 text-center text-text-secondary text-sm">Nothing here.</div>
      )}
    </Card>
  );
}

export function DuePaymentsSections({ today, tomorrow, upcoming, customers }: { today: DueItem[]; tomorrow: DueItem[]; upcoming: DueItem[]; customers: Map<string, Customer> }) {
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Due Today" value={formatCurrency(sum(today))} icon={Calendar} tone="danger" hint={`${today.length} loan${today.length === 1 ? "" : "s"}`} />
        <StatCard label="Due Tomorrow" value={formatCurrency(sum(tomorrow))} icon={Clock} tone="warning" hint={`${tomorrow.length} loan${tomorrow.length === 1 ? "" : "s"}`} />
        <StatCard label="Upcoming (30 days)" value={formatCurrency(sum(upcoming))} icon={TrendingUp} tone="primary" hint={`${upcoming.length} loan${upcoming.length === 1 ? "" : "s"}`} />
        <StatCard label="Total Due" value={formatCurrency(sum(today) + sum(tomorrow) + sum(upcoming))} icon={Wallet} tone="info" />
      </div>
      <Section title="Due Today" sub={formatDate(new Date())} items={today} tone="danger" icon={Calendar} customers={customers} />
      <Section title="Due Tomorrow" sub="Next day" items={tomorrow} tone="warning" icon={Clock} customers={customers} />
      <Section title="Upcoming" sub="Next 30 days" items={upcoming} tone="primary" icon={TrendingUp} customers={customers} />
    </div>
  );
}
