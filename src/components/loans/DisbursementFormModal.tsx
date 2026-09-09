"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { HandCoins, Trash2 } from "lucide-react";
import { useModal } from "@/components/providers/ModalProvider";
import { ModalHeader, ModalBody, ModalFooter, FormError } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormGroup, Input, Textarea } from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { addDisbursementAction, deleteDisbursementAction } from "@/lib/actions/loans";
import { formatCurrency } from "@/lib/format";
import { formatDate, todayStr } from "@/lib/dates";
import type { Disbursement, Loan } from "@/lib/types";

// Records a later hand-over of cash against a loan that wasn't fully
// disbursed on day one (e.g. ₹50,000 now of a ₹1,00,000 agreement, the
// rest given later). Interest only ever accrues from the date money is
// actually handed over — see calculateInterestForLoan — so this is the
// correct way to add a tranche, never editing `principal` after the fact.

function DisbursementFormContent({ loan, pending: pendingAmount }: { loan: Loan; pending: number }) {
  const { closeModal } = useModal();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(String(pendingAmount || ""));
  const [date, setDate] = useState(todayStr());
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await addDisbursementAction(loan.id, {
        amount: Number(amount),
        date,
        notes: String(formData.get("notes") || ""),
      });
      if (!res.ok) return setError(res.error);
      closeModal();
      router.refresh();
      toast.success(`${formatCurrency(Number(amount))} disbursement recorded`);
    });
  }

  return (
    <form action={submit}>
      <ModalHeader title="Add Disbursement" sub={`${loan.id} · ₹${pendingAmount.toLocaleString("en-IN")} still pending of ₹${loan.principal.toLocaleString("en-IN")} agreed`} onClose={closeModal} />
      <ModalBody>
        <div className="flex flex-col gap-4">
          <FormGroup label="Amount Given Now" hint="Interest starts accruing on this amount from the date below — not from the loan's original start date.">
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
          </FormGroup>
          <FormGroup label="Date Given">
            <Input type="date" value={date} min={loan.startDate} max={todayStr()} onChange={(e) => setDate(e.target.value)} required />
          </FormGroup>
          <FormGroup label="Notes (optional)">
            <Textarea name="notes" rows={2} placeholder="e.g. second tranche, handed over in cash" />
          </FormGroup>
        </div>
        <FormError message={error} />
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={closeModal}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          <HandCoins /> Record Disbursement
        </Button>
      </ModalFooter>
    </form>
  );
}

export function useAddDisbursementModal() {
  const { openModal } = useModal();
  return (loan: Loan, pending: number) => openModal(<DisbursementFormContent loan={loan} pending={pending} />, { size: "sm" });
}

export function AddDisbursementButton({ loan, pending }: { loan: Loan; pending: number }) {
  const open = useAddDisbursementModal();
  if (pending <= 0) return null;
  return (
    <Button variant="secondary" onClick={() => open(loan, pending)}>
      <HandCoins /> Add Disbursement
    </Button>
  );
}

export function DisbursementHistoryRow({ d }: { d: Disbursement }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    confirm({
      title: "Remove Disbursement?",
      message: (
        <>
          Remove the {formatCurrency(d.amount)} disbursement recorded on {formatDate(d.date)}? This reduces the loan&rsquo;s disbursed total and interest will be recalculated accordingly.
        </>
      ),
      confirmText: "Remove",
      onConfirm: async () => {
        const res = await deleteDisbursementAction(d.id);
        if (!res.ok) return toast.error(res.error);
        toast.success("Disbursement removed");
        router.refresh();
      },
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border text-[13px] last:border-0">
      <div>
        <div className="font-semibold">{formatCurrency(d.amount)}</div>
        <div className="text-text-tertiary text-[12px]">{formatDate(d.date)}{d.notes ? ` · ${d.notes}` : ""}</div>
      </div>
      <button type="button" onClick={() => startTransition(handleDelete)} disabled={pending} className="text-text-tertiary hover:text-danger p-1.5 rounded-md hover:bg-danger-light transition-colors" title="Remove">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
