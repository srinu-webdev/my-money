"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Download, Eye, Edit, Trash2, Wallet, History, User, Send, CheckCircle2, RefreshCw, XCircle, Search, CreditCard } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Table, TableWrap, Th, SortTh, Td } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { Pagination } from "@/components/ui/Pagination";
import { PillTabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { usePagination, useSort } from "@/lib/hooks/useTableState";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import { FREQ_LABEL, STATUS_LABEL, nextMonthlyCollectionDate } from "@/lib/calculations";
import type { LoanRow } from "@/lib/queries";
import type { LoanStatus } from "@/lib/types";
import { cancelLoanAction, closeLoanAction, deleteLoanAction, reactivateLoanAction } from "@/lib/actions/loans";
import { useEditLoanModal } from "./LoanFormModal";
import { useSendReminder } from "./ReminderFormModal";
import { usePaymentFormModal } from "@/components/payments/PaymentFormModal";
import { exportCSV } from "@/lib/csv";

const FILTERS: { key: LoanStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "PARTIALLY_PAID", label: "Partially Paid" },
  { key: "PAID", label: "Paid" },
  { key: "OVERDUE", label: "Overdue" },
  { key: "CANCELLED", label: "Cancelled" },
];

export function LoansTable({ loans, customerNames }: { loans: LoanRow[]; customerNames: Map<string, string> }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LoanStatus | "all">("all");
  const router = useRouter();
  const confirm = useConfirm();
  const editLoan = useEditLoanModal();
  const sendReminder = useSendReminder();
  const recordPayment = usePaymentFormModal();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: loans.length };
    for (const l of loans) c[l.derivedStatus] = (c[l.derivedStatus] ?? 0) + 1;
    return c;
  }, [loans]);

  const filtered = useMemo(() => {
    let list = loans;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((l) => l.id.toLowerCase().includes(q) || (customerNames.get(l.customerId) ?? "").toLowerCase().includes(q) || String(l.principal).includes(q));
    if (filter !== "all") list = list.filter((l) => l.derivedStatus === filter);
    return list;
  }, [loans, search, filter, customerNames]);

  const { sorted, field, dir, toggle } = useSort(filtered, "createdAt", (l, f) => {
    if (f === "customer") return customerNames.get(l.customerId) ?? "";
    if (f === "outstanding") return l.balance.totalOutstanding;
    return (l as unknown as Record<string, string>)[f] ?? "";
  });
  const { page, setPage, totalPages, pageItems, total, startIdx, endIdx } = usePagination(sorted, 10);

  function handleDelete(l: LoanRow) {
    const withPay = l.balance.paymentsCount > 0;
    confirm({
      title: "Delete Loan?",
      message: (
        <>
          Delete loan <strong>{l.id}</strong> of {formatCurrency(l.principal)} for <strong>{customerNames.get(l.customerId)}</strong>? This cannot be undone.
        </>
      ),
      extra: withPay ? (
        <div className="bg-warning-light text-warning-dark dark:text-amber-300 rounded-[10px] px-3.5 py-2.5 text-[13px] mt-3">
          <strong>This loan has {l.balance.paymentsCount} payment record{l.balance.paymentsCount === 1 ? "" : "s"} totalling {formatCurrency(l.balance.totalPaid)}. Deleting it may affect financial history.</strong> All
          payments for this loan will be permanently removed.
        </div>
      ) : null,
      confirmText: withPay ? "Yes, Delete Loan & Payments" : "Delete Loan",
      onConfirm: async () => {
        const res = await deleteLoanAction(l.id);
        if (!res.ok) return toast.error(res.error);
        toast.success("Loan deleted");
        router.refresh();
      },
    });
  }

  async function handleClose(l: LoanRow) {
    const res = await closeLoanAction(l.id);
    if (!res.ok) return toast.error(res.error, { duration: 6000 });
    toast.success("Loan closed successfully");
    router.refresh();
  }

  function handleCancel(l: LoanRow) {
    confirm({
      title: "Cancel Loan?",
      message: (
        <>
          Mark loan <strong>{l.id}</strong> for <strong>{customerNames.get(l.customerId)}</strong> as cancelled? Interest stops accruing and it is excluded from outstanding totals.
        </>
      ),
      tone: "warning",
      confirmText: "Cancel Loan",
      onConfirm: async () => {
        const res = await cancelLoanAction(l.id);
        if (!res.ok) return toast.error(res.error);
        toast.info("Loan cancelled");
        router.refresh();
      },
    });
  }

  return (
    <Card>
      <div className="flex items-center gap-2.5 flex-wrap p-4 sm:px-[22px] border-b border-border">
        <div className="relative flex-1 min-w-[200px] max-w-[340px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <Input
            className="pl-8"
            placeholder="Search loan ID, customer, amount…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <PillTabs
          tabs={FILTERS.map((f) => ({ key: f.key, label: `${f.label} ${counts[f.key] ?? 0}` }))}
          active={filter}
          onChange={(k) => {
            setFilter(k as LoanStatus | "all");
            setPage(1);
          }}
        />
      </div>

      {total ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <SortTh label="Loan ID" active={field === "id"} dir={dir} onClick={() => toggle("id", true)} />
                  <SortTh label="Customer" active={field === "customer"} dir={dir} onClick={() => toggle("customer", true)} />
                  <SortTh label="Principal" active={field === "principal"} dir={dir} onClick={() => toggle("principal")} />
                  <Th>Rate</Th>
                  <Th>Frequency</Th>
                  <SortTh label="Start" active={field === "startDate"} dir={dir} onClick={() => toggle("startDate")} />
                  <Th>Interest This Month</Th>
                  <Th>Paid This Month</Th>
                  <Th>Principal Paid</Th>
                  <SortTh label="Outstanding" active={field === "outstanding"} dir={dir} onClick={() => toggle("outstanding")} />
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((l) => {
                  const b = l.balance;
                  const open = l.derivedStatus !== "PAID" && l.derivedStatus !== "CANCELLED";
                  return (
                    <tr key={l.id} className={l.derivedStatus === "OVERDUE" ? "bg-danger-light/30 hover:bg-danger-light/50" : "hover:bg-surface-2"}>
                      <Td>
                        <Link href={`/loans/${l.id}`} className="text-primary font-mono font-semibold hover:underline">
                          {l.id}
                        </Link>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <Avatar name={customerNames.get(l.customerId) ?? "?"} size="sm" />
                          <Link href={`/customers/${l.customerId}`} className="font-semibold text-primary hover:underline">
                            {customerNames.get(l.customerId)}
                          </Link>
                        </div>
                      </Td>
                      <Td className="font-semibold">{formatCurrency(l.principal)}</Td>
                      <Td>{l.interestType === "FIXED" ? `${formatCurrency(l.interestRate)} fixed` : `${l.interestRate}%`}</Td>
                      <Td>{FREQ_LABEL[l.interestFrequency]}</Td>
                      <Td className="text-text-secondary">{formatDate(l.startDate)}</Td>
                      <Td>
                        {formatCurrency(b.interestPerPeriod)}
                        {b.interestPendingWhole > 0.01 ? (
                          <div className="text-xs font-normal text-warning-dark">
                            +{Math.round(b.interestPendingWhole / b.interestPerPeriod)} older month{Math.round(b.interestPendingWhole / b.interestPerPeriod) === 1 ? "" : "s"} also pending · {formatCurrency(b.interestPendingWhole)}
                          </div>
                        ) : b.interestPerPeriod > 0 && l.interestFrequency === "MONTHLY" ? (
                          <div className="text-xs font-normal text-text-tertiary">Due {formatDate(nextMonthlyCollectionDate(l.startDate, undefined, l.collectionDay).date)}</div>
                        ) : null}
                      </Td>
                      <Td className={b.interestPaidThisPeriod >= b.interestPerPeriod && b.interestPerPeriod > 0 ? "text-success-dark font-semibold" : "text-success-dark"}>
                        {formatCurrency(b.interestPaidThisPeriod)}
                      </Td>
                      <Td className="text-success-dark">{formatCurrency(b.principalPaid)}</Td>
                      <Td className={`font-semibold ${b.totalOutstanding > 0 ? "text-warning-dark" : "text-success-dark"}`}>{formatCurrency(b.totalOutstanding)}</Td>
                      <Td>
                        <StatusBadge status={l.derivedStatus} />
                        {b.daysOverdue ? <div className="text-xs font-normal text-danger mt-0.5">{b.daysOverdue}d overdue · due {formatDate(l.dueDate)}</div> : null}
                      </Td>
                      <Td>
                        <Dropdown
                          items={[
                            { label: "View Loan", icon: <Eye />, onClick: () => router.push(`/loans/${l.id}`) },
                            { label: "Edit Loan", icon: <Edit />, onClick: () => editLoan(l, b.paymentsCount) },
                            ...(open ? [{ label: "Record Payment", icon: <Wallet />, onClick: () => recordPayment({ loanId: l.id }) }] : []),
                            { label: "Payment History", icon: <History />, onClick: () => router.push(`/loans/${l.id}?tab=payments`) },
                            { label: "View Customer", icon: <User />, onClick: () => router.push(`/customers/${l.customerId}`) },
                            { label: "", sep: true, onClick: () => {} },
                            ...(open
                              ? [
                                  { label: "Send Reminder", icon: <Send />, onClick: () => sendReminder(l.id) },
                                  { label: "Close Loan", icon: <CheckCircle2 />, onClick: () => handleClose(l) },
                                  { label: "Cancel Loan", icon: <XCircle />, onClick: () => handleCancel(l) },
                                ]
                              : []),
                            ...(l.derivedStatus === "CANCELLED"
                              ? [
                                  {
                                    label: "Reactivate Loan",
                                    icon: <RefreshCw />,
                                    onClick: async () => {
                                      const res = await reactivateLoanAction(l.id);
                                      if (!res.ok) return toast.error(res.error);
                                      toast.success("Loan reactivated");
                                      router.refresh();
                                    },
                                  },
                                ]
                              : []),
                            { label: "Delete Loan", icon: <Trash2 />, danger: true, onClick: () => handleDelete(l) },
                          ]}
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
          <Pagination page={page} totalPages={totalPages} total={total} start={startIdx} end={endIdx} label="loans" onChange={setPage} />
        </>
      ) : (
        <EmptyState icon={CreditCard} title="No loans found" text={search || filter !== "all" ? "Try a different search or filter." : "Create your first loan to start tracking interest."} />
      )}
    </Card>
  );
}

export function ExportLoansButton({ loans, customerNames }: { loans: LoanRow[]; customerNames: Map<string, string> }) {
  return (
    <Button
      variant="secondary"
      onClick={() =>
        exportCSV(
          `lendpro-loans-${new Date().toISOString().slice(0, 10)}.csv`,
          ["Loan ID", "Customer", "Principal", "Rate", "Frequency", "Start", "Due", "Interest Accrued", "Interest Paid", "Principal Paid", "Outstanding", "Status"],
          loans.map((l) => [
            l.id,
            customerNames.get(l.customerId) ?? "",
            l.principal,
            l.interestRate,
            FREQ_LABEL[l.interestFrequency],
            formatDate(l.startDate),
            formatDate(l.dueDate),
            l.balance.interestAccrued,
            l.balance.interestPaid,
            l.balance.principalPaid,
            l.balance.totalOutstanding,
            STATUS_LABEL[l.derivedStatus],
          ])
        )
      }
    >
      <Download /> Export CSV
    </Button>
  );
}
