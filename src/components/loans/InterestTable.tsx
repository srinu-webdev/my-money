"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Percent } from "@/components/ui/icons";
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
  // A loan with nothing left owing is "Paid" — including a genuinely
  // interest-free loan (a FIXED rate of ₹0), which never accrues anything
  // to begin with. That used to fall through to `interestAccrued > 0`
  // being false and get stuck showing "Pending" forever, with no payment
  // ever possible to clear it.
  if (l.balance.interestRemaining <= 1) return l.balance.interestAccrued > 0 || l.balance.interestPerPeriod <= 0 ? "Paid" : "Pending";
  if (l.derivedStatus === "OVERDUE") return "Overdue";
  return l.balance.interestPaid > 0 ? "Partial" : "Pending";
}
const TONE: Record<InterestStatus, "warning" | "info" | "success" | "danger"> = { Pending: "warning", Partial: "info", Paid: "success", Overdue: "danger" };

export function InterestTable({ loans, customerNames }: { loans: LoanRow[]; customerNames: Map<string, string> }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InterestStatus | "all">("all");
  const recordPayment = usePaymentFormModal();

  const active = loans.filter((l) => l.derivedStatus !== "CANCELLED");
  const counts = useMemo(() => {
    const c: Record<InterestStatus | "all", number> = { all: active.length, Pending: 0, Partial: 0, Paid: 0, Overdue: 0 };
    active.forEach((l) => c[interestStatus(l)]++);
    return c;
  }, [active]);
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
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
          <PillTabs
            tabs={[
              { key: "all", label: `All ${counts.all}` },
              { key: "Pending", label: `Pending ${counts.Pending}`, muted: counts.Pending === 0 },
              { key: "Partial", label: `Partial ${counts.Partial}`, muted: counts.Partial === 0 },
              { key: "Paid", label: `Paid ${counts.Paid}`, muted: counts.Paid === 0 },
              { key: "Overdue", label: `Overdue ${counts.Overdue}`, muted: counts.Overdue === 0 },
            ]}
            active={filter}
            onChange={(k) => setFilter(k as typeof filter)}
          />
        </div>
        {total ? (
          <>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Customer</Th>
                    <Th>Loan</Th>
                    <Th className="hidden sm:table-cell text-right">Principal</Th>
                    <Th className="hidden lg:table-cell text-right">Rate</Th>
                    <Th className="hidden lg:table-cell">Frequency</Th>
                    <Th className="hidden lg:table-cell text-right">Per Period</Th>
                    <Th className="hidden lg:table-cell text-right">Interest Accrued</Th>
                    <Th className="hidden lg:table-cell text-right">Interest Paid</Th>
                    <Th className="text-right">Interest Pending</Th>
                    <Th className="hidden md:table-cell">Due Date</Th>
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
                      <Td className="hidden sm:table-cell text-right mono-nums">
                        {formatCurrency(l.balance.principalRemaining)}
                        <div className="text-xs text-text-tertiary">of {formatCurrency(l.principal)}</div>
                      </Td>
                      <Td className="hidden lg:table-cell text-right mono-nums">{l.interestType === "FIXED" ? `${formatCurrency(l.interestRate)} fixed` : `${l.interestRate}%`}</Td>
                      <Td className="hidden lg:table-cell">{FREQ_LABEL[l.interestFrequency]}</Td>
                      <Td className="hidden lg:table-cell text-right mono-nums">{formatCurrency(l.balance.interestPerPeriod)}</Td>
                      <Td className="hidden lg:table-cell text-right mono-nums">{formatCurrency(l.balance.interestAccrued)}</Td>
                      <Td className="hidden lg:table-cell text-right mono-nums text-success-dark">{formatCurrency(l.balance.interestPaid)}</Td>
                      <Td className={`text-right mono-nums ${l.balance.interestRemaining > 0 ? "text-warning-dark font-semibold" : ""}`}>{formatCurrency(l.balance.interestRemaining)}</Td>
                      <Td className="hidden md:table-cell text-text-secondary">{formatDate(l.dueDate)}</Td>
                      <Td>
                        <Badge tone={TONE[status]}>{status}</Badge>
                      </Td>
                      <Td>
                        {/* Same >1 threshold `interestStatus` uses for "Paid" above —
                            otherwise a loan badged Paid could still show an active
                            Collect button for a few paise of rounding dust. */}
                        {status !== "Paid" && l.balance.interestRemaining > 1 && l.derivedStatus !== "CANCELLED" ? (
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
