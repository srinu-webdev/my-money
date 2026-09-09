"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Download, Eye, Edit, Trash2, Search, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { Table, TableWrap, Th, SortTh, Td } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { usePagination, useSort } from "@/lib/hooks/useTableState";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import type { Payment, PaymentMethod } from "@/lib/types";
import { deletePaymentAction, bulkDeletePaymentsAction } from "@/lib/actions/payments";
import { usePaymentFormModal } from "./PaymentFormModal";
import { usePaymentViewModal } from "./PaymentViewModal";
import { exportCSV } from "@/lib/csv";

const METHODS: PaymentMethod[] = ["Cash", "UPI", "Bank Transfer", "Cheque", "Other"];

export function PaymentsTable({
  payments,
  customerNames,
  hideCustomer = false,
  hideLoan = false,
  showToolbar = true,
}: {
  payments: Payment[];
  customerNames?: Map<string, string>;
  hideCustomer?: boolean;
  hideLoan?: boolean;
  showToolbar?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const router = useRouter();
  const confirm = useConfirm();
  const editPayment = usePaymentFormModal();
  const viewPayment = usePaymentViewModal();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const nameOf = (id: string) => customerNames?.get(id) ?? id;

  const filtered = useMemo(() => {
    let list = payments;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => [p.id, p.loanId, nameOf(p.customerId), p.reference ?? "", String(p.amount)].some((v) => v.toLowerCase().includes(q)));
    if (method !== "all") list = list.filter((p) => p.paymentMethod === method);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, search, method]);

  const { sorted, field, dir, toggle } = useSort(filtered, "paymentDate", (p, f) => (f === "customer" ? nameOf(p.customerId) : (p as unknown as Record<string, string | number>)[f] ?? ""));
  const { page, setPage, totalPages, pageItems, total, startIdx, endIdx } = usePagination(showToolbar ? sorted : filtered, 10);
  const rows = showToolbar ? pageItems : filtered;

  function handleDelete(p: Payment) {
    confirm({
      title: "Delete Payment?",
      message: (
        <>
          Delete payment <strong>{p.id}</strong> of {formatCurrency(p.amount)} from <strong>{nameOf(p.customerId)}</strong>? The loan balance, interest paid and status will be recalculated.
        </>
      ),
      confirmText: "Delete Payment",
      onConfirm: async () => {
        const res = await deletePaymentAction(p.id);
        if (!res.ok) return toast.error(res.error);
        toast.success("Payment deleted — balances recalculated");
        router.refresh();
      },
    });
  }

  function handleBulkDelete() {
    const ids = [...selected];
    confirm({
      title: `Delete ${ids.length} payment${ids.length === 1 ? "" : "s"}?`,
      message: "Loan balances will be recalculated. This cannot be undone.",
      confirmText: "Delete Payments",
      onConfirm: async () => {
        const res = await bulkDeletePaymentsAction(ids);
        if (!res.ok) return toast.error(res.error);
        toast.success(`${res.data.count} payment(s) deleted`);
        setSelected(new Set());
        router.refresh();
      },
    });
  }

  const allSelected = rows.length > 0 && rows.every((p) => selected.has(p.id));

  return (
    <Card className={showToolbar ? "" : "border-0 shadow-none rounded-none"}>
      {showToolbar && (
        <div className="flex items-center gap-2.5 flex-wrap p-4 sm:px-[22px] border-b border-border">
          <div className="relative flex-1 min-w-[200px] max-w-[340px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <Input
              className="pl-8"
              placeholder="Search payment ID, customer, loan, reference…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            className="w-auto"
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All methods</option>
            {METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
          <span className="ml-auto text-text-secondary text-sm">
            {total} payment{total === 1 ? "" : "s"}
          </span>
        </div>
      )}
      {selected.size > 0 && (
        <div className="flex items-center gap-2.5 px-4 sm:px-[22px] py-2.5 bg-primary-50 border-b border-primary-200 text-[13px] font-medium text-primary-700 dark:text-indigo-300 flex-wrap">
          <span>{selected.size} selected</span>
          <Button size="sm" variant="danger" onClick={handleBulkDelete}>
            <Trash2 /> Delete
          </Button>
          <button className="ml-auto text-xs font-semibold hover:underline" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}
      {rows.length ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) =>
                        setSelected((s) => {
                          const n = new Set(s);
                          rows.forEach((p) => (e.target.checked ? n.add(p.id) : n.delete(p.id)));
                          return n;
                        })
                      }
                      className="w-[15px] h-[15px] accent-primary cursor-pointer"
                    />
                  </Th>
                  <Th>Payment ID</Th>
                  {!hideCustomer && <Th>Customer</Th>}
                  {!hideLoan && <Th>Loan</Th>}
                  {showToolbar ? <SortTh label="Total Amount" active={field === "amount"} dir={dir} onClick={() => toggle("amount")} /> : <Th>Total Amount</Th>}
                  <Th>Interest</Th>
                  <Th>Principal</Th>
                  <Th>Method</Th>
                  {showToolbar ? <SortTh label="Date" active={field === "paymentDate"} dir={dir} onClick={() => toggle("paymentDate")} /> : <Th>Date</Th>}
                  <Th>Reference</Th>
                  <Th>Recorded By</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className={selected.has(p.id) ? "bg-primary-50" : "hover:bg-surface-2"}>
                    <Td>
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() =>
                          setSelected((s) => {
                            const n = new Set(s);
                            if (n.has(p.id)) n.delete(p.id);
                            else n.add(p.id);
                            return n;
                          })
                        }
                        className="w-[15px] h-[15px] accent-primary cursor-pointer"
                      />
                    </Td>
                    <Td>
                      <button onClick={() => viewPayment(p)} className="text-primary font-mono font-semibold hover:underline">
                        {p.id}
                      </button>
                    </Td>
                    {!hideCustomer && (
                      <Td>
                        <div className="flex items-center gap-2">
                          <Avatar name={nameOf(p.customerId)} size="sm" />
                          <Link href={`/customers/${p.customerId}`} className="font-semibold text-primary hover:underline">
                            {nameOf(p.customerId)}
                          </Link>
                        </div>
                      </Td>
                    )}
                    {!hideLoan && (
                      <Td>
                        <Link href={`/loans/${p.loanId}`} className="text-primary font-mono hover:underline">
                          {p.loanId}
                        </Link>
                      </Td>
                    )}
                    <Td className="font-semibold">{formatCurrency(p.amount)}</Td>
                    <Td className="text-success-dark">{formatCurrency(p.interestAmount)}</Td>
                    <Td>{formatCurrency(p.principalAmount)}</Td>
                    <Td>
                      <Badge tone="gray" plain>
                        {p.paymentMethod}
                      </Badge>
                    </Td>
                    <Td className="text-text-secondary">{formatDate(p.paymentDate)}</Td>
                    <Td className="text-text-secondary">{p.reference || "—"}</Td>
                    <Td className="text-text-secondary">{p.recordedBy}</Td>
                    <Td>
                      <Dropdown
                        items={[
                          { label: "View", icon: <Eye />, onClick: () => viewPayment(p) },
                          { label: "Edit", icon: <Edit />, onClick: () => editPayment({ payment: p }) },
                          { label: "Delete", icon: <Trash2 />, danger: true, onClick: () => handleDelete(p) },
                        ]}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
          {showToolbar && <Pagination page={page} totalPages={totalPages} total={total} start={startIdx} end={endIdx} label="payments" onChange={setPage} />}
        </>
      ) : (
        <EmptyState icon={Wallet} title="No payments found" text={search || method !== "all" ? "Try a different search or filter." : "Record your first collection."} />
      )}
    </Card>
  );
}

export function ExportPaymentsButton({ payments, customerNames }: { payments: Payment[]; customerNames: Map<string, string> }) {
  return (
    <Button
      variant="secondary"
      onClick={() =>
        exportCSV(
          `lendpro-payments-${new Date().toISOString().slice(0, 10)}.csv`,
          ["Payment ID", "Customer", "Loan ID", "Amount", "Interest", "Principal", "Method", "Date", "Reference", "Recorded By"],
          payments.map((p) => [p.id, customerNames.get(p.customerId) ?? "", p.loanId, p.amount, p.interestAmount, p.principalAmount, p.paymentMethod, formatDate(p.paymentDate), p.reference ?? "", p.recordedBy])
        )
      }
    >
      <Download /> Export CSV
    </Button>
  );
}
