"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableWrap, Th, Td } from "@/components/ui/Table";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { CustomerPaymentCalendar } from "./CustomerPaymentCalendar";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import { FREQ_LABEL } from "@/lib/calculations";
import type { CustomerRow, LoanRow } from "@/lib/queries";
import type { Activity, Payment } from "@/lib/types";
import { CreditCard, Percent, Wallet } from "lucide-react";

export function CustomerDetailTabs({ customer, loans, payments, activities }: { customer: CustomerRow; loans: LoanRow[]; payments: Payment[]; activities: Activity[] }) {
  const [tab, setTab] = useState("overview");
  const s = customer.summary;
  const pct = s.totalBorrowed ? Math.min(100, Math.round((s.principalPaid / s.totalBorrowed) * 100)) : 0;

  return (
    <Card>
      <Tabs
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "loans", label: `Loans (${loans.length})` },
          { key: "payments", label: "Payments" },
          { key: "calendar", label: "Calendar" },
          { key: "interest", label: "Interest" },
          { key: "activity", label: "Activity" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "overview" && (
        <div className="p-4 sm:p-[22px] grid lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-[14px] font-bold mb-3">Contact Information</h3>
            <div className="flex flex-col">
              {[
                ["Phone", customer.phone],
                ["Email", customer.email || "—"],
                ["Address", customer.address || "—"],
                ["City / State", [customer.city, customer.state].filter(Boolean).join(", ") || "—"],
                ["Postal Code", customer.postalCode || "—"],
                ["Registered", formatDate(customer.createdAt)],
                ["Last Payment", s.lastPaymentDate ? formatDate(s.lastPaymentDate) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 py-2.5 border-b border-border text-[13px]">
                  <span className="text-text-secondary">{k}</span>
                  <span className="font-semibold text-right">{v}</span>
                </div>
              ))}
            </div>
            {customer.notes ? <div className="bg-info-light text-info-dark dark:text-sky-300 rounded-[10px] px-3.5 py-2.5 text-[13px] mt-4">{customer.notes}</div> : null}
          </div>
          <div>
            <h3 className="text-[14px] font-bold mb-3">Repayment Progress</h3>
            <div className="bg-surface-2 border border-border rounded-xl p-4 mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-text-secondary">Principal repaid</span>
                <b>{pct}%</b>
              </div>
              <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-purple rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-text-tertiary mt-2">
                <span>{formatCurrency(s.principalPaid)} paid</span>
                <span>{formatCurrency(s.principalOutstanding)} remaining</span>
              </div>
            </div>
            <h3 className="text-[14px] font-bold mb-3">Active Loans</h3>
            {loans.filter((l) => !["PAID", "CANCELLED"].includes(l.derivedStatus)).length ? (
              loans
                .filter((l) => !["PAID", "CANCELLED"].includes(l.derivedStatus))
                .slice(0, 4)
                .map((l) => (
                  <div key={l.id} className="bg-surface-2 border border-border rounded-xl px-4 py-3 mb-2 flex justify-between items-center gap-3">
                    <div>
                      <Link href={`/loans/${l.id}`} className="font-semibold text-primary hover:underline">
                        {l.id}
                      </Link>
                      <div className="text-xs text-text-tertiary">
                        {formatCurrency(l.principal)} · due {formatDate(l.dueDate)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatCurrency(l.balance.totalOutstanding)}</div>
                      <StatusBadge status={l.derivedStatus} />
                    </div>
                  </div>
                ))
            ) : (
              <p className="text-text-secondary text-sm">No active loans.</p>
            )}
          </div>
        </div>
      )}

      {tab === "loans" &&
        (loans.length ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Loan ID</Th>
                  <Th>Principal</Th>
                  <Th>Rate</Th>
                  <Th>Frequency</Th>
                  <Th>Due</Th>
                  <Th>Interest Accrued</Th>
                  <Th>Outstanding</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id} className="hover:bg-surface-2">
                    <Td>
                      <Link href={`/loans/${l.id}`} className="link text-primary font-mono hover:underline">
                        {l.id}
                      </Link>
                    </Td>
                    <Td className="font-semibold">{formatCurrency(l.principal)}</Td>
                    <Td>{l.interestType === "FIXED" ? `${formatCurrency(l.interestRate)} fixed` : `${l.interestRate}%`}</Td>
                    <Td>{FREQ_LABEL[l.interestFrequency]}</Td>
                    <Td className="text-text-secondary">{formatDate(l.dueDate)}</Td>
                    <Td>{formatCurrency(l.balance.interestAccrued)}</Td>
                    <Td className="font-semibold">{formatCurrency(l.balance.totalOutstanding)}</Td>
                    <Td>
                      <StatusBadge status={l.derivedStatus} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={CreditCard} title="No loans yet" text="Give this customer their first loan." />
        ))}

      {tab === "payments" &&
        (payments.length ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Payment ID</Th>
                  <Th>Loan</Th>
                  <Th>Amount</Th>
                  <Th>Interest</Th>
                  <Th>Principal</Th>
                  <Th>Method</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2">
                    <Td className="font-mono">{p.id}</Td>
                    <Td>
                      <Link href={`/loans/${p.loanId}`} className="text-primary font-mono hover:underline">
                        {p.loanId}
                      </Link>
                    </Td>
                    <Td className="font-semibold">{formatCurrency(p.amount)}</Td>
                    <Td className="text-success-dark">{formatCurrency(p.interestAmount)}</Td>
                    <Td>{formatCurrency(p.principalAmount)}</Td>
                    <Td>
                      <Badge tone="gray" plain>
                        {p.paymentMethod}
                      </Badge>
                    </Td>
                    <Td className="text-text-secondary">{formatDate(p.paymentDate)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={Wallet} title="No payments yet" text="Payments recorded against this customer will appear here." />
        ))}

      {tab === "calendar" && <CustomerPaymentCalendar loans={loans} payments={payments} />}

      {tab === "interest" &&
        (loans.length ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Loan</Th>
                  <Th>Principal</Th>
                  <Th>Rate</Th>
                  <Th>Interest Accrued</Th>
                  <Th>Interest Paid</Th>
                  <Th>Interest Pending</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id} className="hover:bg-surface-2">
                    <Td>
                      <Link href={`/loans/${l.id}`} className="text-primary font-mono hover:underline">
                        {l.id}
                      </Link>
                    </Td>
                    <Td>{formatCurrency(l.balance.principalRemaining)}</Td>
                    <Td>{l.interestType === "FIXED" ? `${formatCurrency(l.interestRate)} fixed` : `${l.interestRate}%`}</Td>
                    <Td>{formatCurrency(l.balance.interestAccrued)}</Td>
                    <Td className="text-success-dark">{formatCurrency(l.balance.interestPaid)}</Td>
                    <Td className={l.balance.interestRemaining ? "text-warning-dark" : ""}>{formatCurrency(l.balance.interestRemaining)}</Td>
                    <Td>
                      <StatusBadge status={l.derivedStatus} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={Percent} title="No interest records" text="Interest is tracked per loan." />
        ))}

      {tab === "activity" && <ActivityList activities={activities} emptyText="No activity for this customer yet." />}
    </Card>
  );
}
