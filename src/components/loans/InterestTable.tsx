"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Percent } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { PillTabs } from "@/components/ui/Tabs";
import { Table, TableWrap, Th, Td } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { usePagination } from "@/lib/hooks/useTableState";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import { FREQ_LABEL } from "@/lib/calculations";
import type { LoanRow } from "@/lib/queries";
import { usePaymentFormModal } from "@/components/payments/PaymentFormModal";

type InterestStatus = "Pending" | "Partial" | "Paid" | "Overdue";

function interestStatus(l: LoanRow): InterestStatus {
  if (l.balance.interestRemaining <= 1) return l.balance.interestAccrued > 0 ? "Paid" : "Pending";
  if (l.derivedStatus === "OVERDUE") return "Overdue";
  return l.balance.interestPaid > 0 ? "Partial" : "Pending";
}
const TONE: Record<InterestStatus, "warning" | "info" | "success" | "danger"> = { Pending: "warning", Partial: "info", Paid: "success", Overdue: "danger" };

export function InterestTable({ loans, customerNames }: { loans: LoanRow[]; customerNames: Map<string, string> }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InterestStatus | "all">("all");
  const recordPayment = usePaymentFormModal();

  const active = loans.filter((l) => l.derivedStatus !== "CANCELLED");
  const totals = active.reduce(
    (a, l) => {
      a.accrued += l.balance.interestAccrued;
      a.paid += l.balance.interestPaid;
      a.pending += l.balance.interestRemaining;
      if (interestStatus(l) === "Overdue") a.overdue += l.balance.interestRemaining;
      return a;
    },
    { accrued: 0, paid: 0, pending: 0, overdue: 0 }
  );

  const filtered = useMemo(() => {
    let list = active.map((l) => ({ l, status: interestStatus(l) }));
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(({ l }) => l.id.toLowerCase().includes(q) || (customerNames.get(l.customerId) ?? "").toLowerCase().includes(q));
    if (filter !== "all") list = list.filter((x) => x.status === filter);
    return list.sort((a, b) => b.l.balance.interestRemaining - a.l.balance.interestRemaining);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, search, filter]);

  const { page, setPage, totalPages, pageItems, total, startIdx, endIdx } = usePagination(filtered, 10);

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          ["Interest Accrued", totals.accrued, "text-text"],
          ["Interest Collected", totals.paid, "text-success-dark"],
          ["Interest Pending", totals.pending, "text-warning-dark"],
          ["Interest Overdue", totals.overdue, "text-danger"],
        ].map(([label, val, cls]) => (
          <div key={label as string} className="bg-surface border border-border rounded-2xl p-5">
            <div className="text-[12.5px] text-text-secondary font-medium">{label}</div>
            <div className={`text-[22px] font-extrabold mt-1 tracking-tight mono-nums ${cls}`}>{formatCurrency(val as number)}</div>
          </div>
        ))}
      </div>
      <Card>
        <div className="flex items-center gap-2.5 flex-wrap p-4 sm:px-[22px] border-b border-border">
          <div className="relative flex-1 min-w-[200px] max-w-[340px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <Input className="pl-8" placeholder="Search loan or customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <PillTabs tabs={[{ key: "all", label: "All" }, { key: "Pending", label: "Pending" }, { key: "Partial", label: "Partial" }, { key: "Paid", label: "Paid" }, { key: "Overdue", label: "Overdue" }]} active={filter} onChange={(k) => setFilter(k as typeof filter)} />
        </div>
        {total ? (
          <>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Customer</Th>
                    <Th>Loan</Th>
                    <Th>Principal</Th>
                    <Th>Rate</Th>
                    <Th>Frequency</Th>
                    <Th>Per Period</Th>
                    <Th>Interest Accrued</Th>
                    <Th>Interest Paid</Th>
                    <Th>Interest Pending</Th>
                    <Th>Due Date</Th>
                    <Th>Status</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(({ l, status }) => (
                    <tr key={l.id} className={status === "Overdue" ? "bg-danger-light/30" : "hover:bg-surface-2"}>
                      <Td>
                        <div className="flex items-center gap-2">
                          <Avatar name={customerNames.get(l.customerId) ?? "?"} size="sm" />
                          <Link href={`/customers/${l.customerId}`} className="font-semibold text-primary hover:underline">
                            {customerNames.get(l.customerId)}
                          </Link>
                        </div>
                      </Td>
                      <Td>
                        <Link href={`/loans/${l.id}`} className="text-primary font-mono hover:underline">
                          {l.id}
                        </Link>
                      </Td>
                      <Td>
                        {formatCurrency(l.balance.principalRemaining)}
                        <div className="text-xs text-text-tertiary">of {formatCurrency(l.principal)}</div>
                      </Td>
                      <Td>{l.interestType === "FIXED" ? `${formatCurrency(l.interestRate)} fixed` : `${l.interestRate}%`}</Td>
                      <Td>{FREQ_LABEL[l.interestFrequency]}</Td>
                      <Td>{formatCurrency(l.balance.interestPerPeriod)}</Td>
                      <Td>{formatCurrency(l.balance.interestAccrued)}</Td>
                      <Td className="text-success-dark">{formatCurrency(l.balance.interestPaid)}</Td>
                      <Td className={l.balance.interestRemaining > 0 ? "text-warning-dark font-semibold" : ""}>{formatCurrency(l.balance.interestRemaining)}</Td>
                      <Td className="text-text-secondary">{formatDate(l.dueDate)}</Td>
                      <Td>
                        <Badge tone={TONE[status]}>{status}</Badge>
                      </Td>
                      <Td>
                        {l.balance.interestRemaining > 0 && l.derivedStatus !== "CANCELLED" ? (
                          <Button size="sm" variant="soft" onClick={() => recordPayment({ loanId: l.id, allocation: "interest" })}>
                            Collect
                          </Button>
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            <Pagination page={page} totalPages={totalPages} total={total} start={startIdx} end={endIdx} label="loans" onChange={setPage} />
          </>
        ) : (
          <EmptyState icon={Percent} title="No interest records" text="Interest is tracked automatically for every active loan." />
        )}
      </Card>
    </div>
  );
}
