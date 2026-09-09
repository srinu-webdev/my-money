"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { CheckCircle2, Edit, RefreshCw, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { cancelLoanAction, closeLoanAction, deleteLoanAction, reactivateLoanAction } from "@/lib/actions/loans";
import { formatCurrency } from "@/lib/format";
import type { Loan, LoanStatus } from "@/lib/types";
import { useEditLoanModal } from "./LoanFormModal";
import { RecordPaymentButton } from "@/components/payments/PaymentFormModal";
import { SendReminderButton } from "./ReminderFormModal";

export function LoanDetailActions({ loan, paymentsCount, status }: { loan: Loan; paymentsCount: number; status: LoanStatus }) {
  const router = useRouter();
  const confirm = useConfirm();
  const editLoan = useEditLoanModal();
  const [pending, startTransition] = useTransition();
  const open = status !== "PAID" && status !== "CANCELLED";

  function handleDelete() {
    confirm({
      title: "Delete Loan?",
      message: (
        <>
          Delete loan <strong>{loan.id}</strong> of {formatCurrency(loan.principal)}? This cannot be undone.
        </>
      ),
      extra: paymentsCount ? (
        <div className="bg-warning-light text-warning-dark dark:text-amber-300 rounded-[10px] px-3.5 py-2.5 text-[13px] mt-3">
          <strong>This loan has {paymentsCount} payment record{paymentsCount === 1 ? "" : "s"}. Deleting it may affect financial history.</strong> All payments will be permanently removed.
        </div>
      ) : null,
      confirmText: paymentsCount ? "Yes, Delete Loan & Payments" : "Delete Loan",
      onConfirm: async () => {
        const res = await deleteLoanAction(loan.id);
        if (!res.ok) return toast.error(res.error);
        toast.success("Loan deleted");
        router.push("/loans");
      },
    });
  }

  function handleClose() {
    startTransition(async () => {
      const res = await closeLoanAction(loan.id);
      if (!res.ok) return toast.error(res.error, { duration: 6000 });
      toast.success("Loan closed successfully");
      router.refresh();
    });
  }

  function handleCancel() {
    confirm({
      title: "Cancel Loan?",
      message: "Interest stops accruing and it is excluded from outstanding totals.",
      tone: "warning",
      confirmText: "Cancel Loan",
      onConfirm: async () => {
        const res = await cancelLoanAction(loan.id);
        if (!res.ok) return toast.error(res.error);
        toast.info("Loan cancelled");
        router.refresh();
      },
    });
  }

  function handleReactivate() {
    startTransition(async () => {
      const res = await reactivateLoanAction(loan.id);
      if (!res.ok) return toast.error(res.error);
      toast.success("Loan reactivated");
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {open && <SendReminderButton loanId={loan.id} />}
      <Button variant="secondary" onClick={() => editLoan(loan, paymentsCount)}>
        <Edit /> Edit
      </Button>
      {status === "CANCELLED" && (
        <Button variant="secondary" loading={pending} onClick={handleReactivate}>
          <RefreshCw /> Reactivate
        </Button>
      )}
      {open && (
        <>
          <Button variant="ghost" onClick={handleCancel}>
            <XCircle /> Cancel Loan
          </Button>
          <Button variant="secondary" loading={pending} onClick={handleClose}>
            <CheckCircle2 /> Close Loan
          </Button>
          <RecordPaymentButton loanId={loan.id} />
        </>
      )}
      <Button variant="ghost" className="text-danger" onClick={handleDelete}>
        <Trash2 />
      </Button>
    </div>
  );
}
