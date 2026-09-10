"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Printer, Wallet, TrendingUp, Percent, Receipt, Clock, CreditCard, AlertTriangle, Users } from "@/components/ui/icons";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PillTabs } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Field";
import { StatCard } from "@/components/ui/StatCard";
import { Table, TableWrap, Th, Td } from "@/components/ui/Table";
import { MoneyBarChart, StackedMoneyBarChart, MoneyLineChart, CountBarChart } from "@/components/charts/Charts";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import { getLastNMonths, monthlyAggregate } from "@/lib/chart-utils";
import { computeReport, reportRange, type ReportRangeKey } from "@/lib/reports";
import { exportCSV } from "@/lib/csv";
import type { Customer, Disbursement, Loan, Payment } from "@/lib/types";

const RANGES: { key: ReportRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "this-month", label: "This Month" },
  { key: "last-month", label: "Last Month" },
  { key: "this-year", label: "This Year" },
  { key: "all", label: "All Time" },
  { key: "custom", label: "Custom" },
];

export function ReportsView({
  loans,
  payments,
  customers,
  disbursements = [],
}: {
  loans: Loan[];
  payments: Payment[];
  customers: Customer[];
  disbursements?: Disbursement[];
}) {
  const [rangeKey, setRangeKey] = useState<ReportRangeKey>("this-month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const nameOf = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);

  const range = reportRange(rangeKey, customFrom, customTo);
  const rep = computeReport(loans, payments, customers, range, disbursements);

  const byMethod = useMemo(() => {
    const m: Record<string, number> = {};
    rep.periodPayments.forEach((p) => (m[p.paymentMethod] = (m[p.paymentMethod] ?? 0) + p.amount));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [rep.periodPayments]);

  const months12 = getLastNMonths(12);
  const activeLoans = loans.filter((l) => l.status !== "CANCELLED");
  const lending = monthlyAggregate(activeLoans, (l) => l.startDate, (l) => l.principal, months12);
  const interestSeries = monthlyAggregate(payments, (p) => p.paymentDate, (p) => p.interestAmount, months12);
  const principalSeries = monthlyAggregate(payments, (p) => p.paymentDate, (p) => p.principalAmount, months12);
  const months6 = getLastNMonths(6);
  const before6 = customers.filter((c) => new Date(c.createdAt) < new Date(months6[0].y, months6[0].m, 1)).length;
  const cumulative = monthlyAggregate(customers, (c) => c.createdAt, () => 1, months6).reduce<number[]>((acc, v) => {
    acc.push((acc.length ? acc[acc.length - 1] : before6) + v);
    return acc;
  }, []);

  function exportReport() {
    const rows: (string | number)[][] = [
      ["Metric", "Value"],
      ["Period", rep.range.label],
      ["Total Money Lent", rep.lent],
      ["Loans Disbursed", rep.lentCount],
      ["Principal Collected", rep.principalCollected],
      ["Interest Collected", rep.interestCollected],
      ["Total Collections", rep.totalCollected],
      ["Payments Recorded", rep.paymentsCount],
      ["New Customers", rep.newCustomers],
      ["Interest Pending (portfolio)", rep.interestPending],
      ["Principal Outstanding (portfolio)", rep.principalOutstanding],
      ["Total Outstanding (portfolio)", rep.outstanding],
      ["Overdue Amount", rep.overdue],
      ["Overdue Loans", rep.overdueCount],
      [],
      ["Month", "Money Lent", "Interest Collected", "Principal Collected"],
    ];
    months12.forEach((m, i) => rows.push([m.label, lending[i], interestSeries[i], principalSeries[i]]));
    exportCSV(`lendpro-report-${new Date().toISOString().slice(0, 10)}.csv`, rows[0] as string[], rows.slice(1) as (string | number)[][]);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Reports</h1>
          <p className="text-text-secondary text-[13.5px] mt-0.5">
            Business performance for <strong>{rep.range.label}</strong>.
          </p>
        </div>
        <div className="flex gap-2.5 flex-wrap no-print">
          <Button variant="secondary" onClick={exportReport}>
            <Download /> Export CSV
          </Button>
          <Button onClick={() => window.print()}>
            <Printer /> Print Report
          </Button>
        </div>
      </div>

      <div className="hidden print:block mb-4">
        <h2 className="text-xl font-bold">LendPro — Business Report</h2>
        <div className="text-text-secondary text-sm">
          Period: {rep.range.label} · Generated {formatDate(new Date())}
        </div>
      </div>

      <Card className="mb-5 no-print">
        <div className="p-4 flex items-center gap-3 flex-wrap">
          <PillTabs tabs={RANGES} active={rangeKey} onChange={(k) => setRangeKey(k as ReportRangeKey)} />
          {rangeKey === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <span className="text-text-tertiary text-sm">to</span>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Total Money Lent" value={formatCurrency(rep.lent)} icon={Wallet} tone="primary" hint={`${rep.lentCount} loan${rep.lentCount === 1 ? "" : "s"} disbursed in period`} />
        <StatCard label="Principal Collected" value={formatCurrency(rep.principalCollected)} icon={TrendingUp} tone="success" hint="In period" />
        <StatCard label="Interest Collected" value={formatCurrency(rep.interestCollected)} icon={Percent} tone="success" hint="In period" />
        <StatCard label="Total Collections" value={formatCurrency(rep.totalCollected)} icon={Receipt} tone="info" hint={`${rep.paymentsCount} payment${rep.paymentsCount === 1 ? "" : "s"}`} />
        <StatCard label="Interest Pending" value={formatCurrency(rep.interestPending)} icon={Clock} tone="warning" hint="Portfolio-wide, as of today" />
        <StatCard label="Total Outstanding" value={formatCurrency(rep.outstanding)} icon={CreditCard} tone="purple" hint="Portfolio-wide, as of today" />
        <StatCard label="Overdue Amount" value={formatCurrency(rep.overdue)} icon={AlertTriangle} tone="danger" hint={`${rep.overdueCount} overdue loan${rep.overdueCount === 1 ? "" : "s"}`} />
        <StatCard label="New Customers" value={rep.newCustomers} icon={Users} tone="primary" hint="Registered in period" />
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Card>
          <CardHeader title="Monthly Lending" sub="Principal disbursed — last 12 months" />
          <div className="p-4 h-[260px]">
            <MoneyBarChart labels={months12.map((m) => m.label)} data={lending} color="primary" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Monthly Collections" sub="Interest vs principal collected" />
          <div className="p-4 h-[260px]">
            <StackedMoneyBarChart labels={months12.map((m) => m.label)} series={[{ label: "Interest", data: interestSeries, color: "#8b5cf6" }, { label: "Principal", data: principalSeries, color: "#10b981" }]} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Monthly Interest" sub="Interest collected per month" />
          <div className="p-4 h-[260px]">
            <MoneyLineChart labels={months12.map((m) => m.label)} data={interestSeries} color="purple" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Customer Growth" sub="Cumulative customers" />
          <div className="p-4 h-[260px]">
            <CountBarChart labels={months6.map((m) => m.label)} data={cumulative} color="info" />
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mt-5">
        <Card>
          <CardHeader title={`Collections by Method (${rep.range.label})`} />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Method</Th>
                  <Th>Amount</Th>
                  <Th>Share</Th>
                </tr>
              </thead>
              <tbody>
                {byMethod.length ? (
                  byMethod.map(([m, v]) => (
                    <tr key={m}>
                      <Td>{m}</Td>
                      <Td className="font-semibold">{formatCurrency(v)}</Td>
                      <Td>{rep.totalCollected ? Math.round((v / rep.totalCollected) * 100) : 0}%</Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <Td colSpan={3} className="text-text-secondary">
                      No collections in this period.
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
        <Card>
          <CardHeader title={`Loans Disbursed (${rep.range.label})`} />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Loan</Th>
                  <Th>Customer</Th>
                  <Th>Principal</Th>
                  <Th>Start</Th>
                </tr>
              </thead>
              <tbody>
                {rep.lentLoans.length ? (
                  [...rep.lentLoans]
                    .sort((a, b) => b.startDate.localeCompare(a.startDate))
                    .slice(0, 8)
                    .map((l) => (
                      <tr key={l.id}>
                        <Td>
                          <Link href={`/loans/${l.id}`} className="text-primary font-mono hover:underline">
                            {l.id}
                          </Link>
                        </Td>
                        <Td>{nameOf.get(l.customerId)}</Td>
                        <Td className="font-semibold">{formatCurrency(l.principal)}</Td>
                        <Td className="text-text-secondary">{formatDate(l.startDate)}</Td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <Td colSpan={4} className="text-text-secondary">
                      No loans disbursed in this period.
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </div>

      <p className="text-center text-[11.5px] text-text-tertiary mt-6 leading-relaxed">
        This software is a record-keeping and management tool. Interest calculations and lending practices should comply with applicable local laws and regulations.
      </p>
    </div>
  );
}
