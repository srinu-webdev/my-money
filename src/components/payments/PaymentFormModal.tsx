"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Plus, Wallet } from "lucide-react";
import { useModal } from "@/components/providers/ModalProvider";
import { ModalHeader, ModalBody, ModalFooter, FormError } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormGroup, Input, Select } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/Badge";
import { createPaymentAction, updatePaymentAction } from "@/lib/actions/payments";
import { getCustomerOptionsAction, getLoanForPaymentFormAction, getLoanOptionsAction, type LoanOption } from "@/lib/actions/options";
import { calculateLoanBalance, computeAllocation, getLoanStatus } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";
import { todayStr } from "@/lib/dates";
import type { AllocationMode, Customer, Loan, Payment, PaymentMethod } from "@/lib/types";

const METHODS: PaymentMethod[] = ["Cash", "UPI", "Bank Transfer", "Cheque", "Other"];
const ALLOC_OPTIONS: { value: AllocationMode; label: string }[] = [
  { value: "interest_principal", label: "Interest + Principal (interest first)" },
  { value: "interest", label: "Interest Only" },
  { value: "principal", label: "Principal Only" },
  { value: "custom", label: "Custom Split" },
];

function PaymentFormContent({ payment, defaultLoanId, defaultCustomerId, defaultAllocation, customers }: { payment?: Payment; defaultLoanId?: string; defaultCustomerId?: string; defaultAllocation?: AllocationMode; customers: Customer[] }) {
  const { closeModal } = useModal();
  const router = useRouter();
  const editing = !!payment;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [customerId, setCustomerId] = useState(payment?.customerId ?? defaultCustomerId ?? "");
  const [loanId, setLoanId] = useState(payment?.loanId ?? defaultLoanId ?? "");
  const [loanOptions, setLoanOptions] = useState<LoanOption[]>([]);
  const [loanDetail, setLoanDetail] = useState<{ loan: Loan; payments: Payment[] } | null>(null);
  const [amount, setAmount] = useState(String(payment?.amount ?? ""));
  const [paymentDate, setPaymentDate] = useState(payment?.paymentDate ?? todayStr());
  const [allocation, setAllocation] = useState<AllocationMode>(editing ? "custom" : defaultAllocation ?? "interest_principal");
  const [customInterest, setCustomInterest] = useState(String(payment?.interestAmount ?? ""));
  const [customPrincipal, setCustomPrincipal] = useState(String(payment?.principalAmount ?? ""));

  // Loan options refresh whenever the chosen customer changes.
  useEffect(() => {
    getLoanOptionsAction(customerId || undefined, payment?.loanId).then(setLoanOptions);
  }, [customerId, payment?.loanId]);

  // Full loan + payment history, for the client-side allocation preview.
  // The state updates are wrapped in an async IIFE (rather than called
  // synchronously in the effect body) with a `cancelled` guard, so a fast
  // second loan selection can't have its earlier fetch resolve last and
  // clobber the newer choice.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!loanId) {
        if (!cancelled) setLoanDetail(null);
        return;
      }
      const r = await getLoanForPaymentFormAction(loanId);
      if (cancelled) return;
      setLoanDetail(r);
      if (r && customerId !== r.loan.customerId) setCustomerId(r.loan.customerId);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId]);

  const existingPayments = useMemo(() => (loanDetail ? loanDetail.payments.filter((p) => p.id !== payment?.id) : []), [loanDetail, payment?.id]);

  const alloc = useMemo(() => {
    if (!loanDetail) return null;
    return computeAllocation(loanDetail.loan, existingPayments, Number(amount) || 0, allocation, { interestAmount: Number(customInterest), principalAmount: Number(customPrincipal) }, paymentDate || todayStr());
  }, [loanDetail, existingPayments, amount, allocation, customInterest, customPrincipal, paymentDate]);

  const loanStatus = useMemo(() => {
    if (!loanDetail) return null;
    return getLoanStatus(loanDetail.loan, calculateLoanBalance(loanDetail.loan, existingPayments));
  }, [loanDetail, existingPayments]);

  function submit(formData: FormData) {
    setError(null);
    const payload = {
      loanId,
      amount: Number(amount),
      paymentDate,
      paymentMethod: String(formData.get("paymentMethod")) as PaymentMethod,
      allocation,
      customInterest: allocation === "custom" ? Number(customInterest) : undefined,
      customPrincipal: allocation === "custom" ? Number(customPrincipal) : undefined,
      reference: String(formData.get("reference") || ""),
      notes: String(formData.get("notes") || ""),
    };
    startTransition(async () => {
      const res = editing ? await updatePaymentAction(payment.id, payload) : await createPaymentAction(payload);
      if (!res.ok) return setError(res.error);
      toast.success(editing ? "Payment updated — balances recalculated" : `Payment of ${formatCurrency(payload.amount)} recorded successfully`);
      closeModal();
      router.refresh();
    });
  }

  return (
    <form action={submit}>
      <ModalHeader title={editing ? "Edit Payment" : "Record Payment"} sub={editing ? payment.id : "Collect money against a loan"} onClose={closeModal} />
      <ModalBody>
        {editing ? <div className="bg-info-light text-info-dark dark:text-sky-300 rounded-[10px] px-3.5 py-2.5 text-[13px] mb-4">Editing a payment recalculates all balances for the affected loan automatically.</div> : null}
        <div className="grid sm:grid-cols-2 gap-4">
          <FormGroup label="Customer" required>
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">All customers</option>
              {customers
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.id}
                  </option>
                ))}
            </Select>
          </FormGroup>
          <FormGroup label="Loan" required>
            <Select value={loanId} onChange={(e) => setLoanId(e.target.value)}>
              <option value="">Select loan…</option>
              {loanOptions.map((o) => (
                <option key={o.loan.id} value={o.loan.id}>
                  {o.loan.id} · {formatCurrency(o.loan.principal)} · Outstanding {formatCurrency(o.outstanding)}
                </option>
              ))}
            </Select>
          </FormGroup>

          <div className="sm:col-span-2 bg-primary-50 border border-dashed border-primary-200 rounded-[10px] px-3.5 py-3 text-[13px] text-primary-700 dark:text-indigo-300">
            {loanDetail ? (
              <>
                <div className="flex justify-between flex-wrap gap-2">
                  <span>
                    <strong>{loanDetail.loan.id}</strong> · {loanDetail.loan.interestType === "FIXED" ? `${formatCurrency(loanDetail.loan.interestRate)} fixed` : `${loanDetail.loan.interestRate}%`}
                  </span>
                  {loanStatus ? <StatusBadge status={loanStatus} /> : null}
                </div>
                {alloc ? (
                  <div className="grid sm:grid-cols-3 gap-2 mt-2 text-sm">
                    <div>
                      Interest due (as of {paymentDate || todayStr()}): <strong>{formatCurrency(alloc.interestRemaining)}</strong>
                    </div>
                    <div>
                      Principal due: <strong>{formatCurrency(alloc.principalRemaining)}</strong>
                    </div>
                    <div>
                      Total outstanding: <strong>{formatCurrency(alloc.interestRemaining + alloc.principalRemaining)}</strong>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              "Select a loan to see its outstanding balance."
            )}
          </div>

          <FormGroup label="Payment Amount (₹)" required>
            <Input type="number" min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" />
          </FormGroup>
          <FormGroup label="Payment Date" required>
            <Input type="date" value={paymentDate} max={todayStr()} onChange={(e) => setPaymentDate(e.target.value)} />
          </FormGroup>
          <FormGroup label="Payment Method">
            <Select name="paymentMethod" defaultValue={payment?.paymentMethod ?? "Cash"}>
              {METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </FormGroup>
          <FormGroup label="Payment Allocation">
            <Select value={allocation} onChange={(e) => setAllocation(e.target.value as AllocationMode)}>
              {ALLOC_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormGroup>

          {alloc && Number(amount) > 0 ? <AllocationPreview alloc={alloc} amount={Number(amount)} allocation={allocation} /> : null}

          {allocation === "custom" ? (
            <>
              <FormGroup label="Interest Amount (₹)">
                <Input type="number" min={0} step="0.01" value={customInterest} onChange={(e) => setCustomInterest(e.target.value)} />
              </FormGroup>
              <FormGroup label="Principal Amount (₹)">
                <Input type="number" min={0} step="0.01" value={customPrincipal} onChange={(e) => setCustomPrincipal(e.target.value)} />
              </FormGroup>
            </>
          ) : null}

          <FormGroup label="Reference Number">
            <Input name="reference" defaultValue={payment?.reference ?? ""} placeholder="UTR / cheque no. / receipt" />
          </FormGroup>
          <FormGroup label="Notes">
            <Input name="notes" defaultValue={payment?.notes ?? ""} placeholder="Optional" />
          </FormGroup>
        </div>
        <FormError message={error} />
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={closeModal}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {editing ? "Update Payment" : "Record Payment"}
        </Button>
      </ModalFooter>
    </form>
  );
}

function AllocationPreview({ alloc, amount, allocation }: { alloc: ReturnType<typeof computeAllocation>; amount: number; allocation: AllocationMode }) {
  const total = alloc.interestAmount + alloc.principalAmount;
  const mismatch = allocation === "custom" && Math.abs(total - amount) > 0.01;
  const over = allocation !== "custom" && alloc.unallocated > 0.01;
  const tone = mismatch || over ? (mismatch ? "bg-danger-light text-danger-dark dark:text-red-300" : "bg-warning-light text-warning-dark dark:text-amber-300") : "bg-success-light text-success-dark dark:text-emerald-300";
  return (
    <div className={`sm:col-span-2 rounded-[10px] px-3.5 py-2.5 text-[13px] ${tone}`}>
      Allocation: <strong>{formatCurrency(alloc.interestAmount)}</strong> to interest + <strong>{formatCurrency(alloc.principalAmount)}</strong> to principal
      {mismatch ? ` — must equal payment amount ${formatCurrency(amount)} (difference ${formatCurrency(amount - total)})` : over ? ` — ${formatCurrency(alloc.unallocated)} exceeds the outstanding balance and will not be allocated.` : "."}
      <div className="text-xs mt-1 opacity-80">
        After payment → principal remaining {formatCurrency(Math.max(0, alloc.principalRemaining - alloc.principalAmount))}, interest remaining {formatCurrency(Math.max(0, alloc.interestRemaining - alloc.interestAmount))}
      </div>
    </div>
  );
}

export function usePaymentFormModal() {
  const { openModal } = useModal();
  return async (opts?: { payment?: Payment; loanId?: string; customerId?: string; allocation?: AllocationMode }) => {
    const customers = await getCustomerOptionsAction();
    if (!customers.length) return;
    openModal(<PaymentFormContent payment={opts?.payment} defaultLoanId={opts?.loanId} defaultCustomerId={opts?.customerId} defaultAllocation={opts?.allocation} customers={customers} />, { size: "lg" });
  };
}

export function RecordPaymentButton({ loanId, customerId, label = "Record Payment", variant = "primary" }: { loanId?: string; customerId?: string; label?: string; variant?: "primary" | "secondary" }) {
  const open = usePaymentFormModal();
  const [pending, startTransition] = useTransition();
  return (
    <Button variant={variant} loading={pending} onClick={() => startTransition(() => open({ loanId, customerId }))}>
      <Wallet /> {label}
    </Button>
  );
}

export function AddPaymentIconButton() {
  const open = usePaymentFormModal();
  const [pending, startTransition] = useTransition();
  return (
    <Button loading={pending} onClick={() => startTransition(() => open())}>
      <Plus /> Record Payment
    </Button>
  );
}
