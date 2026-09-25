"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Plus } from "@/components/ui/icons";
import { useModal } from "@/components/providers/ModalProvider";
import { ModalHeader, ModalBody, ModalFooter, FormError } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormGroup, Input, Select, Textarea } from "@/components/ui/Field";
import { createLoanAction, updateLoanAction } from "@/lib/actions/loans";
import { getLoanFormDefaultsAction } from "@/lib/actions/options";
import type { Customer, InterestFrequency, InterestType, Loan } from "@/lib/types";
import { FREQ_LABEL, FREQ_NOUN, calculateInterestForLoan } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";
import { addMonths, businessNow, daysBetween, formatDate, todayStr, toISODate } from "@/lib/dates";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";

// Purely descriptive — nothing in the interest engine branches on these
// strings except "Daily Installment" specifically (it switches on a few
// daily-loan-only UI/filtering paths elsewhere). Order matches how the
// business actually talks about its own loan types.
const REPAYMENT_TYPES = ["Interest Only", "Daily Installment", "Principal + Interest", "Custom"] as const;
const FREQUENCIES: InterestFrequency[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

interface Draft {
  customerId?: string;
  principal?: string;
  interestRate?: string;
  interestType?: InterestType;
  interestFrequency?: InterestFrequency;
  startDate?: string;
  dueDate?: string;
  repaymentType?: string;
  notes?: string;
}

function LoanFormContent({
  loan,
  paymentsCount,
  customers,
  defaults,
  draft,
}: {
  loan?: Loan;
  paymentsCount?: number;
  customers: Customer[];
  defaults: { defaultInterestRate: number; defaultInterestType: InterestType; defaultFrequency: InterestFrequency; defaultRepaymentType: string };
  draft?: Draft;
}) {
  const { closeModal, openModal } = useModal();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = !!loan;

  const [customerId, setCustomerId] = useState(loan?.customerId ?? draft?.customerId ?? "");
  const [principal, setPrincipal] = useState(String(loan?.principal ?? draft?.principal ?? ""));
  const [interestType, setInterestType] = useState<InterestType>(loan?.interestType ?? draft?.interestType ?? defaults.defaultInterestType);
  const [interestRate, setInterestRate] = useState(String(loan?.interestRate ?? draft?.interestRate ?? defaults.defaultInterestRate));
  const [interestFrequency, setInterestFrequency] = useState<InterestFrequency>(loan?.interestFrequency ?? draft?.interestFrequency ?? defaults.defaultFrequency);
  const [startDate, setStartDate] = useState(loan?.startDate ?? draft?.startDate ?? todayStr());
  // businessNow(), matching startDate's todayStr() above — not new Date(),
  // which would let this default due date silently land a calendar day off
  // whenever the server's UTC clock and the business's IST day disagree.
  const [dueDate, setDueDate] = useState(loan?.dueDate ?? draft?.dueDate ?? toISODate(addMonths(businessNow(), 6)));
  const [repaymentType, setRepaymentType] = useState(loan?.repaymentType ?? draft?.repaymentType ?? defaults.defaultRepaymentType);
  const [totalTarget, setTotalTarget] = useState("");

  const freqWord = FREQ_NOUN[interestFrequency];

  // Convenience reverse-calculator for Daily Installment loans: real
  // lending businesses usually agree "borrow ₹40,000, pay back ₹45,000
  // total" rather than a quoted interest rate. Rather than modelling that
  // as a separate concept, this just derives the equivalent Fixed ₹/day
  // rate and sets it — the loan is still stored the same way as every
  // other loan (one rate + frequency), so interest accrual, reports and
  // the rest of the app all stay consistent; this is purely a UI shortcut.
  function applyTotalTarget(value: string) {
    setTotalTarget(value);
    const total = Number(value) || 0;
    const p = Number(principal) || 0;
    const days = startDate && dueDate ? daysBetween(startDate, dueDate) : 0;
    if (total > 0 && days > 0 && total >= p) {
      setInterestType("FIXED");
      setInterestFrequency("DAILY");
      setInterestRate(String(Math.round(((total - p) / days) * 100) / 100));
    }
  }

  const preview = useMemo(() => {
    const p = Number(principal) || 0;
    const r = Number(interestRate) || 0;
    if (!p) return null;
    // This is THIS loan's own number, not a store-wide rate: two customers
    // on the same day can have entirely different figures here, because
    // each loan carries its own rate — never assume it's the same for
    // everyone, and never hardcode a percentage anywhere downstream.
    const perPeriod = interestType === "FIXED" ? r : (p * r) / 100;
    const days = startDate && dueDate ? daysBetween(startDate, dueDate) : 0;
    // Projected interest by the due date, from the SAME engine that will
    // actually calculate it once the loan exists (calculateInterestForLoan)
    // — not a separate, simplified days/30 formula, which silently
    // over/under-counts real calendar months and could show a projection
    // here that the loan will never actually accrue.
    const projectedInterest =
      days > 0
        ? calculateInterestForLoan(
            { principal: p, startDate, interestRate: r, interestType, interestFrequency, status: "ACTIVE", cancelledAt: null, paidAt: null },
            dueDate,
            []
          )
        : 0;
    const periods = perPeriod > 0 ? Math.round(projectedInterest / perPeriod) : 0;
    return { perPeriod, days, periods, projectedInterest, total: p + projectedInterest };
  }, [principal, interestRate, interestType, interestFrequency, startDate, dueDate]);

  const repaymentNote = useMemo(() => {
    if (!preview) return null;
    const per = formatCurrency(preview.perPeriod);
    const prin = formatCurrency(Number(principal) || 0);
    switch (repaymentType) {
      case "Interest Only":
        return `Interest Only: collect ${per} every ${freqWord} from this customer. The full principal (${prin}) stays outstanding until you record a principal payment or close the loan.`;
      case "Principal + Interest":
        return `Principal + Interest: both the ${prin} principal and the interest accrued along the way (${per} per ${freqWord} on the current balance) are collected together, typically in one settlement at the end — not paid off periodically like Interest Only.`;
      case "Daily Installment": {
        if (preview.days <= 0) return "Daily Installment: set a due date after the start date to calculate the daily amount.";
        const dailyAmount = preview.total / preview.days;
        return `Daily Installment: from ${formatDate(startDate)} to ${formatDate(dueDate)} (${preview.days} days), collect ${formatCurrency(dailyAmount)} every single day to fully close this loan — ${prin} principal + ${formatCurrency(preview.projectedInterest)} projected interest = ${formatCurrency(preview.total)} total, spread evenly. This ${formatCurrency(dailyAmount)}/day figure is specific to this loan's own amount and term — a different principal or a shorter/longer term will always need a different daily amount.`;
      }
      default:
        return `Custom plan: interest still accrues at ${per} every ${freqWord} regardless of the collection schedule you agree with the customer.`;
    }
  }, [preview, repaymentType, principal, freqWord, startDate, dueDate]);

  function openAddCustomer() {
    openModal(
      <CustomerFormModal
        onSaved={async (id) => {
          setCustomerId(id);
          // Re-fetch rather than reuse the `customers` closed over from
          // when this form first opened — that array predates the customer
          // just created, so the reopened <Select> would have `customerId`
          // pointed at an id with no matching <option>, rendering blank
          // even though the right customer is technically "selected".
          const { customers: freshCustomers } = await getLoanFormDefaultsAction();
          openModal(
            <LoanFormContent loan={loan} paymentsCount={paymentsCount} customers={freshCustomers} defaults={defaults} draft={{ customerId: id, principal, interestRate, interestType, interestFrequency, startDate, dueDate }} />,
            { size: "lg" }
          );
        }}
      />,
      { size: "lg" }
    );
  }

  function submit(formData: FormData) {
    setError(null);
    const payload = {
      customerId,
      principal: Number(formData.get("principal")),
      interestRate: Number(formData.get("interestRate")),
      interestType,
      interestFrequency,
      startDate,
      dueDate,
      repaymentType: String(formData.get("repaymentType")),
      notes: String(formData.get("notes") || ""),
    };
    startTransition(async () => {
      if (editing) {
        const res = await updateLoanAction(loan.id, payload);
        if (!res.ok) return setError(res.error);
        toast.success("Loan updated successfully");
        closeModal();
        router.refresh();
      } else {
        const res = await createLoanAction(payload);
        if (!res.ok) return setError(res.error);
        toast.success("Loan created successfully");
        closeModal();
        router.refresh();
        router.push(`/loans/${res.data.id}`);
      }
    });
  }

  return (
    <form action={submit}>
      <ModalHeader title={editing ? "Edit Loan" : "Give New Loan"} sub={editing ? `${loan.id}` : "Disburse money to a customer"} onClose={closeModal} />
      <ModalBody>
        {editing && paymentsCount ? (
          <div className="bg-warning-light text-warning-dark dark:text-amber-300 rounded-[10px] px-3.5 py-2.5 text-[13px] mb-4">
            This loan has {paymentsCount} payment{paymentsCount === 1 ? "" : "s"}. Changing the principal, rate, frequency or start date will recalculate all balances.
          </div>
        ) : null}
        <div className="grid sm:grid-cols-2 gap-4">
          <FormGroup label="Customer" required className="sm:col-span-2">
            <div className="flex gap-2">
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="flex-1">
                <option value="">Select customer…</option>
                {customers
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.id}
                      {c.status === "INACTIVE" ? " (Inactive)" : ""}
                    </option>
                  ))}
              </Select>
              <Button type="button" variant="secondary" onClick={openAddCustomer}>
                <Plus /> New
              </Button>
            </div>
          </FormGroup>
          <FormGroup label="Loan Amount (₹)" required>
            <Input type="number" name="principal" min={1} step="1" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="1,00,000" />
          </FormGroup>
          <FormGroup label="Interest Rate Type">
            <Select value={interestType} onChange={(e) => setInterestType(e.target.value as InterestType)}>
              <option value="PERCENTAGE">Percentage (%)</option>
              <option value="FIXED">Fixed Amount (₹)</option>
            </Select>
          </FormGroup>
          <FormGroup label="Interest Rate" required hint="Percentage of outstanding principal, or a fixed ₹ amount, per period">
            <Input type="number" name="interestRate" min={0} step="0.01" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} placeholder="2" />
          </FormGroup>
          <FormGroup label="Interest Frequency">
            <Select value={interestFrequency} onChange={(e) => setInterestFrequency(e.target.value as InterestFrequency)}>
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {FREQ_LABEL[f]}
                </option>
              ))}
            </Select>
          </FormGroup>
          <FormGroup label="Repayment Type">
            <Select name="repaymentType" value={repaymentType} onChange={(e) => setRepaymentType(e.target.value)}>
              {REPAYMENT_TYPES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </FormGroup>
          <FormGroup label="Start Date" required>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </FormGroup>
          <FormGroup label="Due Date" required>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </FormGroup>
          {repaymentType === "Daily Installment" ? (
            <FormGroup
              label="Total Amount to Collect (₹)"
              className="sm:col-span-2"
              hint="Optional shortcut: enter the total you agreed to collect back (principal + your profit) and the daily rate above is calculated for you."
            >
              <Input type="number" min={Number(principal) || 0} step="1" value={totalTarget} onChange={(e) => applyTotalTarget(e.target.value)} placeholder={`e.g. ${(Number(principal) || 0) + 5000}`} />
            </FormGroup>
          ) : null}
          <div className="sm:col-span-2 bg-primary-50 border border-dashed border-primary-200 rounded-[10px] px-3.5 py-3 text-[13px] text-primary-700 dark:text-indigo-300">
            {preview ? (
              <>
                <div className="flex justify-between flex-wrap gap-2">
                  <div>
                    {interestType === "FIXED" ? (
                      <>
                        Fixed ₹{interestRate || 0} every {freqWord} <span className="opacity-70">(not a percentage — the same ₹{interestRate || 0} regardless of the {formatCurrency(Number(principal))} balance)</span>
                      </>
                    ) : (
                      <>
                        {interestRate || 0}% of {formatCurrency(Number(principal))}, every {freqWord}
                      </>
                    )}
                    {" → "}
                    <strong className="text-[15px]">{formatCurrency(preview.perPeriod)}</strong>
                  </div>
                  <div className="text-text-secondary">{preview.days > 0 ? `Term: ${preview.days} days → ${preview.periods} full ${preview.periods === 1 ? FREQ_NOUN[interestFrequency] : FREQ_NOUN[interestFrequency] + "s"}` : "—"}</div>
                </div>
                {interestFrequency !== "DAILY" ? (
                  <div className="text-xs mt-1.5 opacity-70">
                    Interest builds up gradually through each {freqWord} — once a {freqWord} fully completes unpaid, the whole {formatCurrency(preview.perPeriod)} for it is locked in (no discount for paying late within it), and a fresh {freqWord} starts accruing from there.
                  </div>
                ) : null}
                {repaymentNote ? <div className="text-xs mt-2 pt-2 border-t border-primary-200/60 leading-relaxed">{repaymentNote}</div> : null}
                <div className="text-xs mt-1.5 opacity-80">
                  Projected interest till due date (if no principal is repaid early): <strong>{formatCurrency(preview.projectedInterest)}</strong> · Total payable ≈{" "}
                  <strong>{formatCurrency(preview.total)}</strong>
                </div>
              </>
            ) : (
              "Enter a loan amount to preview interest."
            )}
          </div>
          <FormGroup label="Notes" className="sm:col-span-2">
            <Textarea name="notes" defaultValue={loan?.notes ?? draft?.notes ?? ""} placeholder="Purpose, security, guarantor, terms…" />
          </FormGroup>
        </div>
        <FormError message={error} />
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={closeModal}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {editing ? "Update Loan" : "Create Loan"}
        </Button>
      </ModalFooter>
    </form>
  );
}

export function useAddLoanModal() {
  const { openModal } = useModal();
  const confirmNoCustomers = useNoCustomersConfirm();
  return async (opts?: { customerId?: string }) => {
    const { customers, settings } = await getLoanFormDefaultsAction();
    if (!customers.length) return confirmNoCustomers();
    openModal(<LoanFormContent customers={customers} defaults={settings} draft={{ customerId: opts?.customerId }} />, { size: "lg" });
  };
}

export function useEditLoanModal() {
  const { openModal } = useModal();
  return async (loan: Loan, paymentsCount: number) => {
    const { customers, settings } = await getLoanFormDefaultsAction();
    openModal(<LoanFormContent loan={loan} paymentsCount={paymentsCount} customers={customers} defaults={settings} />, { size: "lg" });
  };
}

function useNoCustomersConfirm() {
  const { openModal, closeModal } = useModal();
  return () =>
    openModal(
      <>
        <ModalHeader title="No customers yet" onClose={closeModal} />
        <ModalBody>You need at least one customer before creating a loan.</ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={closeModal}>
            Cancel
          </Button>
          <Button onClick={() => openModal(<CustomerFormModal />, { size: "lg" })}>Add Customer</Button>
        </ModalFooter>
      </>,
      { size: "sm" }
    );
}

export function AddLoanButton({ customerId, label = "Give New Loan" }: { customerId?: string; label?: string }) {
  const open = useAddLoanModal();
  const [pending, startTransition] = useTransition();
  return (
    <Button loading={pending} onClick={() => startTransition(() => open({ customerId }))}>
      <Plus /> {label}
    </Button>
  );
}
