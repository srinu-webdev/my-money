"use client";

import { useState } from "react";
import { Info } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Table, TableWrap, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { PaymentsTable } from "@/components/payments/PaymentsTable";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import type { LoanScheduleSegment } from "@/lib/calculations";
import type { Activity, Payment } from "@/lib/types";
import { Wallet } from "@/components/ui/icons";

export function LoanDetailTabs({ payments, schedule, activities, interestAccrued }: { payments: Payment[]; schedule: LoanScheduleSegment[]; activities: Activity[]; interestAccrued: number }) {
  const [tab, setTab] = useState("payments");

  return (
    <Card>
      <Tabs
        tabs={[
          { key: "payments", label: `Payment History (${payments.length})` },
          { key: "schedule", label: "Interest Breakdown" },
          { key: "activity", label: "Activity" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "payments" &&
        (payments.length ? (
          <PaymentsTable payments={payments} hideCustomer hideLoan />
        ) : (
          <EmptyState icon={Wallet} title="No payments yet" text="Record the first payment for this loan." />
        ))}
      {tab === "schedule" && (
        <div>
          <div className="p-4 sm:p-[22px] pb-2">
            <div className="flex gap-2.5 bg-info-light text-info-dark dark:text-sky-300 rounded-[10px] px-3.5 py-2.5 text-[13px]">
              <Info className="w-[18px] h-[18px] shrink-0 mt-0.5" />
              <span>Interest accrues <strong>pro-rata on the outstanding principal</strong>. Each time principal is repaid, a new segment starts on the reduced balance.</span>
            </div>
          </div>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>From</Th>
                  <Th>To</Th>
                  <Th>Duration</Th>
                  <Th>Principal Balance</Th>
                  <Th>Interest</Th>
                  <Th>Event</Th>
                </tr>
              </thead>
              <tbody>
                {schedule.length ? (
                  schedule.map((s, i) => (
                    <tr key={i}>
                      <Td>{formatDate(s.from)}</Td>
                      <Td>{formatDate(s.to)}</Td>
                      <Td>{s.periods > 0 ? `${s.days} d (${s.periods} full period${s.periods === 1 ? "" : "s"} owed)` : `${s.days} d (in progress, not yet a full period)`}</Td>
                      <Td>{formatCurrency(s.principal)}</Td>
                      <Td>{formatCurrency(s.interest)}</Td>
                      <Td className="text-text-secondary">{s.event}</Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <Td colSpan={6} className="text-text-secondary">
                      No accrual yet — loan starts in the future.
                    </Td>
                  </tr>
                )}
                <tr className="bg-surface-2">
                  <Td colSpan={4} className="font-bold">
                    Total interest accrued
                  </Td>
                  <Td className="font-bold">{formatCurrency(interestAccrued)}</Td>
                  <Td />
                </tr>
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}
      {tab === "activity" && <ActivityList activities={activities} emptyText="No activity for this loan yet." showLinks={false} />}
    </Card>
  );
}
