"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Download, Eye, Edit, Trash2, CheckCircle2, XCircle, Plus, Search, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { Table, TableWrap, Th, SortTh, Td } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm, useAlert } from "@/components/ui/ConfirmDialog";
import { usePagination, useSort } from "@/lib/hooks/useTableState";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import type { CustomerRow } from "@/lib/queries";
import { bulkDeleteCustomersAction, bulkSetCustomerStatusAction, deleteCustomerAction, setCustomerStatusAction } from "@/lib/actions/customers";
import { useAddCustomerModal, useEditCustomerModal } from "./CustomerFormModal";
import { useAddLoanModal } from "@/components/loans/LoanFormModal";
import { exportCSV } from "@/lib/csv";

const FILTERS = [
  ["all", "All customers"],
  ["active", "Active"],
  ["inactive", "Inactive"],
  ["new", "New (30 days)"],
  ["has-active-loan", "Has active loan"],
  ["has-overdue-loan", "Has overdue loan"],
  ["no-loans", "No loans"],
] as const;

export function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  // Read once via a lazy initializer rather than calling Date.now() inside
  // the filter memo below — render must stay a pure function of props/state.
  const [now] = useState(() => Date.now());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const router = useRouter();
  const confirm = useConfirm();
  const alertModal = useAlert();
  const openAdd = useAddCustomerModal();
  const openEdit = useEditCustomerModal();
  const openAddLoan = useAddLoanModal();

  const filtered = useMemo(() => {
    let list = customers;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((c) => [c.name, c.phone, c.email, c.id, c.city].some((v) => (v || "").toLowerCase().includes(q)));
    if (filter === "active") list = list.filter((c) => c.status === "ACTIVE");
    else if (filter === "inactive") list = list.filter((c) => c.status === "INACTIVE");
    else if (filter === "new") list = list.filter((c) => (now - new Date(c.createdAt).getTime()) / 86400000 <= 30);
    else if (filter === "has-active-loan") list = list.filter((c) => c.summary.activeLoans > 0);
    else if (filter === "has-overdue-loan") list = list.filter((c) => c.summary.overdueLoans > 0);
    else if (filter === "no-loans") list = list.filter((c) => c.summary.totalLoans === 0);
    if (from) list = list.filter((c) => c.createdAt >= from);
    if (to) list = list.filter((c) => c.createdAt <= to + "T23:59:59");
    return list;
  }, [customers, search, filter, from, to, now]);

  const { sorted, field, dir, toggle } = useSort(filtered, "createdAt", (c, f) => {
    if (f === "borrowed") return c.summary.totalBorrowed;
    if (f === "paid") return c.summary.totalPayments;
    if (f === "outstanding") return c.summary.totalOutstanding;
    if (f === "name") return c.name;
    return (c as unknown as Record<string, string>)[f] ?? "";
  });
  const { page, setPage, totalPages, pageItems, total, startIdx, endIdx } = usePagination(sorted, 10);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = pageItems.length > 0 && pageItems.every((c) => selected.has(c.id));
  function toggleOne(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAll(checked: boolean) {
    setSelected((s) => {
      const n = new Set(s);
      pageItems.forEach((c) => (checked ? n.add(c.id) : n.delete(c.id)));
      return n;
    });
  }

  function handleDelete(c: CustomerRow) {
    if (c.summary.activeLoans > 0) {
      return alertModal({
        title: "Cannot Delete Customer",
        message: (
          <>
            <strong>{c.name}</strong> has {c.summary.activeLoans} active loan{c.summary.activeLoans === 1 ? "" : "s"} with {formatCurrency(c.summary.totalOutstanding)} outstanding.
            <br />
            <br />
            This customer has active loans. Please close or transfer the loans before deleting the customer.
          </>
        ),
      });
    }
    confirm({
      title: "Delete Customer?",
      message: (
        <>
          Are you sure you want to delete <strong>{c.name}</strong> ({c.id})?
          {c.summary.totalLoans ? ` Their ${c.summary.totalLoans} closed loan record${c.summary.totalLoans === 1 ? "" : "s"} and payment history will also be removed.` : ""} This action cannot
          be undone.
        </>
      ),
      confirmText: "Delete Customer",
      onConfirm: async () => {
        const res = await deleteCustomerAction(c.id);
        if (!res.ok) return toast.error(res.error);
        toast.success("Customer deleted successfully");
        router.refresh();
      },
    });
  }

  function handleBulkDelete() {
    const ids = [...selected];
    confirm({
      title: `Delete ${ids.length} customer${ids.length === 1 ? "" : "s"}?`,
      message: "Customers with active loans will be skipped automatically.",
      confirmText: `Delete ${ids.length}`,
      onConfirm: async () => {
        const res = await bulkDeleteCustomersAction(ids);
        if (!res.ok) return toast.error(res.error);
        toast.success(res.data.deleted ? `${res.data.deleted} customer(s) deleted${res.data.blocked ? `, ${res.data.blocked} skipped (active loans)` : ""}` : "No customers deleted", {
          duration: 5000,
        });
        setSelected(new Set());
        router.refresh();
      },
    });
  }

  async function bulkStatus(status: "ACTIVE" | "INACTIVE") {
    const res = await bulkSetCustomerStatusAction([...selected], status);
    if (!res.ok) return toast.error(res.error);
    toast.success(`${res.data.count} customer(s) marked ${status === "ACTIVE" ? "Active" : "Inactive"}`);
    setSelected(new Set());
    router.refresh();
  }

  return (
    <Card>
      <div className="flex items-center gap-2.5 flex-wrap p-4 sm:px-[22px] border-b border-border">
        <div className="relative flex-1 min-w-[200px] max-w-[340px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <Input
            className="pl-8"
            placeholder="Search name, phone, email, ID…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          className="w-auto min-w-[150px]"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as typeof filter);
            setPage(1);
          }}
        >
          {FILTERS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Input type="date" className="w-auto" value={from} onChange={(e) => setFrom(e.target.value)} title="Registered from" />
        <span className="text-text-tertiary text-sm">to</span>
        <Input type="date" className="w-auto" value={to} onChange={(e) => setTo(e.target.value)} title="Registered to" />
        <span className="ml-auto text-text-secondary text-sm">
          {total} customer{total === 1 ? "" : "s"}
        </span>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2.5 px-4 sm:px-[22px] py-2.5 bg-primary-50 border-b border-primary-200 text-[13px] font-medium text-primary-700 dark:text-indigo-300 flex-wrap">
          <span>{selected.size} selected</span>
          <Button size="sm" variant="secondary" onClick={() => bulkStatus("ACTIVE")}>
            <CheckCircle2 /> Activate
          </Button>
          <Button size="sm" variant="secondary" onClick={() => bulkStatus("INACTIVE")}>
            <XCircle /> Deactivate
          </Button>
          <Button size="sm" variant="danger" onClick={handleBulkDelete}>
            <Trash2 /> Delete
          </Button>
          <button className="ml-auto text-xs font-semibold hover:underline" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      {total ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>
                    <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} className="w-[15px] h-[15px] accent-primary cursor-pointer" />
                  </Th>
                  <SortTh label="Customer ID" active={field === "id"} dir={dir} onClick={() => toggle("id", true)} />
                  <SortTh label="Customer" active={field === "name"} dir={dir} onClick={() => toggle("name", true)} />
                  <Th>Phone</Th>
                  <Th>Email</Th>
                  <SortTh label="Total Borrowed" active={field === "borrowed"} dir={dir} onClick={() => toggle("borrowed")} />
                  <SortTh label="Total Paid" active={field === "paid"} dir={dir} onClick={() => toggle("paid")} />
                  <Th>Interest Paid</Th>
                  <SortTh label="Outstanding" active={field === "outstanding"} dir={dir} onClick={() => toggle("outstanding")} />
                  <Th>Active Loans</Th>
                  <Th>Status</Th>
                  <SortTh label="Created" active={field === "createdAt"} dir={dir} onClick={() => toggle("createdAt")} />
                  <Th />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((c) => (
                  <tr key={c.id} className={selected.has(c.id) ? "bg-primary-50" : "hover:bg-surface-2"}>
                    <Td>
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} className="w-[15px] h-[15px] accent-primary cursor-pointer" />
                    </Td>
                    <Td className="font-mono text-text-tertiary">{c.id}</Td>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.name} size="sm" />
                        <div>
                          <Link href={`/customers/${c.id}`} className="font-semibold text-primary hover:underline">
                            {c.name}
                          </Link>
                          <div className="text-[11.5px] text-text-tertiary">{c.city || "—"}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>{c.phone}</Td>
                    <Td className="text-text-secondary">{c.email || "—"}</Td>
                    <Td className="mono-nums font-semibold">{formatCurrency(c.summary.totalBorrowed)}</Td>
                    <Td className="mono-nums font-semibold text-success-dark">{formatCurrency(c.summary.totalPayments)}</Td>
                    <Td className="mono-nums font-semibold">{formatCurrency(c.summary.interestPaid)}</Td>
                    <Td className={`mono-nums font-semibold ${c.summary.totalOutstanding > 0 ? "text-warning-dark" : ""}`}>{formatCurrency(c.summary.totalOutstanding)}</Td>
                    <Td>
                      {c.summary.activeLoans}
                      {c.summary.overdueLoans ? (
                        <Badge tone="danger" plain className="ml-1.5 px-1.5">
                          {c.summary.overdueLoans} overdue
                        </Badge>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge tone={c.status === "ACTIVE" ? "success" : "gray"}>{c.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>
                    </Td>
                    <Td className="text-text-secondary">{formatDate(c.createdAt)}</Td>
                    <Td>
                      <Dropdown
                        items={[
                          { label: "View", icon: <Eye />, onClick: () => router.push(`/customers/${c.id}`) },
                          { label: "Edit", icon: <Edit />, onClick: () => openEdit(c) },
                          { label: "Give Loan", icon: <Plus />, onClick: () => openAddLoan({ customerId: c.id }) },
                          { sep: true, label: "", onClick: () => {} },
                          {
                            label: c.status === "ACTIVE" ? "Deactivate" : "Activate",
                            icon: c.status === "ACTIVE" ? <XCircle /> : <CheckCircle2 />,
                            onClick: async () => {
                              const res = await setCustomerStatusAction(c.id, c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
                              if (!res.ok) return toast.error(res.error);
                              toast.success(`Customer ${c.status === "ACTIVE" ? "deactivated" : "activated"}`);
                              router.refresh();
                            },
                          },
                          { label: "Delete", icon: <Trash2 />, danger: true, onClick: () => handleDelete(c) },
                        ]}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
          <Pagination page={page} totalPages={totalPages} total={total} start={startIdx} end={endIdx} label="customers" onChange={setPage} />
        </>
      ) : (
        <EmptyState
          icon={Users}
          title="No customers found"
          text={search || filter !== "all" ? "Try adjusting your search or filters." : "Add your first borrower to start lending."}
          action={
            <Button onClick={() => openAdd()}>
              <Plus /> Add Customer
            </Button>
          }
        />
      )}
    </Card>
  );
}

export function ExportCustomersButton({ customers }: { customers: CustomerRow[] }) {
  return (
    <Button
      variant="secondary"
      onClick={() =>
        exportCSV(
          `lendpro-customers-${new Date().toISOString().slice(0, 10)}.csv`,
          ["Customer ID", "Name", "Phone", "Email", "Status", "Total Borrowed", "Total Paid", "Outstanding", "Active Loans", "Created"],
          customers.map((c) => [c.id, c.name, c.phone, c.email ?? "", c.status, c.summary.totalBorrowed, c.summary.totalPayments, c.summary.totalOutstanding, c.summary.activeLoans, formatDate(c.createdAt)])
        )
      }
    >
      <Download /> Export CSV
    </Button>
  );
}
