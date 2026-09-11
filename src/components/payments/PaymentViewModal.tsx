"use client";

import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Edit, Printer, Trash } from "@/components/ui/icons";
import { useModal } from "@/components/providers/ModalProvider";
import { ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { MiniStat } from "@/components/ui/StatCard";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { deletePaymentAction } from "@/lib/actions/payments";
import { formatCurrency } from "@/lib/format";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { Payment } from "@/lib/types";
import { usePaymentFormModal } from "./PaymentFormModal";
import { printReceipt } from "./print-receipt";

function PaymentViewContent({ payment }: { payment: Payment }) {
  const { closeModal } = useModal();
  const router = useRouter();
  const confirm = useConfirm();
  const editPayment = usePaymentFormModal();

  function del() {
    confirm({
      title: "Delete Payment?",
      message: (
        <>
          Delete payment <strong>{payment.id}</strong> of {formatCurrency(payment.amount)}? The loan balance, interest paid and status will be recalculated.
        </>
      ),
      confirmText: "Delete Payment",
      onConfirm: async () => {
        const res = await deletePaymentAction(payment.id);
        if (!res.ok) return toast.error(res.error);
        toast.success("Payment deleted — balances recalculated");
        closeModal();
        router.refresh();
      },
    });
  }

  return (
    <>
      <ModalHeader title="Payment Details" sub={payment.id} onClose={closeModal} />
      <ModalBody>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <MiniStat label="Total Amount" value={formatCurrency(payment.amount)} />
          <MiniStat label="Interest Portion" value={formatCurrency(payment.interestAmount)} className="text-success-dark" />
          <MiniStat label="Principal Portion" value={formatCurrency(payment.principalAmount)} />
        </div>
        <div className="flex flex-col">
          {[
            ["Loan", payment.loanId],
            ["Payment Date", formatDate(payment.paymentDate)],
            ["Method", payment.paymentMethod],
            ["Reference", payment.reference || "—"],
            ["Notes", payment.notes || "—"],
            ["Recorded By", payment.recordedBy],
            ["Created", formatDateTime(payment.createdAt)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 py-2.5 border-b border-border text-[13px] last:border-0">
              <span className="text-text-secondary">{k}</span>
              <span className="font-semibold text-right">{v}</span>
            </div>
          ))}
        </div>
      </ModalBody>
      <ModalFooter between>
        <Button variant="ghost-danger" onClick={del}>
          <Trash /> Delete
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => printReceipt(payment)}>
            <Printer /> Receipt
          </Button>
          <Button
            onClick={() => {
              closeModal();
              editPayment({ payment });
            }}
          >
            <Edit /> Edit
          </Button>
        </div>
      </ModalFooter>
    </>
  );
}

export function usePaymentViewModal() {
  const { openModal } = useModal();
  return (payment: Payment) => openModal(<PaymentViewContent payment={payment} />, { size: "md" });
}
