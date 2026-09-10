"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Search, AlertTriangle, CheckCircle, Download, Send } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { PillTabs } from "@/components/ui/Tabs";
import { Table, TableWrap, Th, Td } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { usePagination } from "@/lib/hooks/useTableState";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import type { LoanRow } from "@/lib/queries";
import type { Customer } from "@/lib/types";
import { usePaymentFormModal } from "@/components/payments/PaymentFormModal";
import { useSendReminder } from "@/components/loans/ReminderFormModal";
import { remindAllOverdueAction } from "@/lib/actions/reminders";
import { exportCSV } from "@/lib/csv";

type Bucket = "all" | "1-7" | "8-30" | "31-90" | "90+";
function bucketOf(days: number): Bucket {
  return days <= 7 ? "1-7" : days <= 30 ? "8-30" : days <= 90 ? "31-90" : "90+";
}

export function OverdueTable({ loans, customers }: { loans: LoanRow[]; customers: Map<string, Customer> }) {
  const overdue = loans.filter((l) => l.derivedStatus === "OVERDUE");
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<Bucket>("all");
  const router = useRouter();
  const recordPayment = usePaymentFormModal();
  const sendReminder = useSendReminder();

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { all: overdue.length, "1-7": 0, "8-30": 0, "31-90": 0, "90+": 0 };
    overdue.forEach((l) => c[bucketOf(l.balance.daysOverdue)]++);
    return c;
  }, [overdue]);

  const totalOutstanding = overdue.reduce((s, l) => s + l.balance.totalOutstanding, 0);

  const filtered = useMemo(() => {
    let list = overdue;
    if (bucket !== "all") list = list.filter((l) => bucketOf(l.balance.daysOverdue) === bucket);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((l) => l.id.toLowerCase().includes(q) || (customers.get(l.customerId)?.name ?? "").toLowerCase().includes(q));
    return [...list].sort((a, b) => b.balance.daysOverdue - a.balance.daysOverdue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overdue, bucket, search]);

  const { page, setPage, totalPages, pageItems, total, startIdx, endIdx } = usePagination(filtered, 10);

  async function remindAll() {
    const res = await remindAllOverdueAction();
    if (!res.ok) return toast.error(res.error);
    toast.info(`${res.data.count} reminder${res.data.count === 1 ? "" : "s"} sent successfully`);
    router.refresh();
  }

  function sev(days: number) {
    return days > 30 ? "danger" : "warning";
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Overdue</h1>
          <p className="text-text-secondary text-[13.5px] mt-0.5">Loans past their due date with an outstanding balance. Act on the oldest first.</p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <Button
            variant="secondary"
            onClick={() =>
              exportCSV(
                `lendpro-overdue-${new Date().toISOString().slice(0, 10)}.csv`,
                ["Customer", "Phone", "Loan ID", "Principal", "Outstanding", "Due Date", "Days Overdue"],
                overdue.map((l) => [customers.get(l.customerId)?.name ?? "", customers.get(l.customerId)?.phone ?? "", l.id, l.principal, l.balance.totalOutstanding, formatDate(l.dueDate), l.balance.daysOverdue])
              )
            }
          >
            <Download /> Export CSV
          </Button>
          <Button variant="danger" onClick={remindAll}>
            <Send /> Remind All
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Overdue Loans" value={counts.all} icon={AlertTriangle} tone="danger" />
        <StatCard label="Overdue Amount" value={formatCurrency(totalOutstanding)} icon={AlertTriangle} tone="danger" hint="Principal + pending interest" />
        <StatCard label="1–30 Days" value={counts["1-7"] + counts["8-30"]} icon={AlertTriangle} tone="warning" hint="Early stage" />
        <StatCard label="30+ Days" value={counts["31-90"] + counts["90+"]} icon={AlertTriangle} tone="danger" hint="Needs escalation" />
      </div>
      <Card>
        <div className="flex items-center gap-2.5 flex-wrap p-4 sm:px-[22px] border-b border-border">
          <div className="relative flex-1 min-w-[200px] max-w-[340px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <Input className="pl-8" placeholder="Search loan or customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <PillTabs
            tabs={[
              { key: "all", label: `All ${counts.all}` },
              { key: "1-7", label: `1–7 days ${counts["1-7"]}` },
              { key: "8-30", label: `8–30 days ${counts["8-30"]}` },
              { key: "31-90", label: `31–90 days ${counts["31-90"]}` },
              { key: "90+", label: `90+ days ${counts["90+"]}` },
            ]}
            active={bucket}
            onChange={(k) => setBucket(k as Bucket)}
          />
        </div>
        {total ? (
          <>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Customer</Th>
                    <Th className="hidden sm:table-cell">Phone</Th>
                    <Th className="hidden md:table-cell">Loan ID</Th>
                    <Th className="hidden lg:table-cell">Original Principal</Th>
                    <Th className="hidden lg:table-cell">Outstanding Principal</Th>
                    <Th className="hidden lg:table-cell">Interest Pending</Th>
                    <Th>Total Outstanding</Th>
                    <Th className="hidden md:table-cell">Due Date</Th>
                    <Th>Days Overdue</Th>
                    <Th className="hidden lg:table-cell">Last Payment</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((l) => {
                    const c = customers.get(l.customerId);
                    return (
                      <tr key={l.id} className="bg-danger-light/30">
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
                        <Td className="hidden lg:table-cell">{formatCurrency(l.principal)}</Td>
                        <Td className="hidden lg:table-cell">{formatCurrency(l.balance.principalRemaining)}</Td>
                        <Td className="hidden lg:table-cell text-warning-dark">{formatCurrency(l.balance.interestRemaining)}</Td>
                        <Td className="font-bold text-danger">{formatCurrency(l.balance.totalOutstanding)}</Td>
                        <Td className="hidden md:table-cell text-danger">{formatDate(l.dueDate)}</Td>
                        <Td>
                          <Badge tone={sev(l.balance.daysOverdue)}>
                            {l.balance.daysOverdue} day{l.balance.daysOverdue === 1 ? "" : "s"}
                          </Badge>
                        </Td>
                        <Td className="hidden lg:table-cell text-text-secondary">
                          {l.balance.lastPaymentDate ? (
                            <>
                              {formatDate(l.balance.lastPaymentDate)}
                              <div className="text-xs text-text-tertiary">{formatCurrency(l.balance.lastPaymentAmount)}</div>
                            </>
                          ) : (
                            <span className="text-text-tertiary">Never</span>
                          )}
                        </Td>
                        <Td>
                          <div className="flex gap-1.5">
                            <Button size="sm" onClick={() => recordPayment({ loanId: l.id })}>
                              Collect
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => sendReminder(l.id)}>
                              <Send />
                            </Button>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
            <Pagination page={page} totalPages={totalPages} total={total} start={startIdx} end={endIdx} label="overdue loans" onChange={setPage} />
          </>
        ) : (
          <EmptyState icon={CheckCircle} title="No overdue loans" text={bucket !== "all" || search ? "No loans match this filter." : "Great — every loan is within its due date."} />
        )}
      </Card>
    </div>
  );
}
