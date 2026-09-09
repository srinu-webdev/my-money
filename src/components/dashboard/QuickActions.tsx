"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, CreditCard, Wallet, CalendarDays, AlertTriangle, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAddCustomerModal } from "@/components/customers/CustomerFormModal";
import { useAddLoanModal } from "@/components/loans/LoanFormModal";
import { usePaymentFormModal } from "@/components/payments/PaymentFormModal";

export function QuickActions({ showTopButtons, grid }: { showTopButtons?: boolean; grid?: boolean }) {
  const router = useRouter();
  const openCustomer = useAddCustomerModal();
  const openLoan = useAddLoanModal();
  const openPayment = usePaymentFormModal();
  const [pending, startTransition] = useTransition();

  const actions = [
    { label: "Add Customer", icon: UserPlus, cls: "bg-primary-50 text-primary-600", onClick: () => openCustomer() },
    { label: "Give New Loan", icon: CreditCard, cls: "bg-purple/10 text-purple", onClick: () => startTransition(() => openLoan()) },
    { label: "Record Payment", icon: Wallet, cls: "bg-success-light text-success-dark", onClick: () => startTransition(() => openPayment()) },
    { label: "View Due Payments", icon: CalendarDays, cls: "bg-warning-light text-warning-dark", onClick: () => router.push("/due-payments") },
    { label: "View Overdue", icon: AlertTriangle, cls: "bg-danger-light text-danger", onClick: () => router.push("/overdue") },
    { label: "Generate Report", icon: FileBarChart, cls: "bg-info-light text-info-dark", onClick: () => router.push("/reports") },
  ];

  if (showTopButtons) {
    return (
      <div className="flex gap-2.5 flex-wrap">
        <Button variant="secondary" loading={pending} onClick={() => startTransition(() => openPayment())}>
          <Wallet /> Record Payment
        </Button>
        <Button loading={pending} onClick={() => startTransition(() => openLoan())}>
          <CreditCard /> Give New Loan
        </Button>
      </div>
    );
  }

  return (
    <div className={grid ? "grid grid-cols-3 gap-2.5" : "flex gap-2.5 flex-wrap"}>
      {actions.map((a) => (
        <button key={a.label} onClick={a.onClick} className="flex flex-col items-center gap-2 px-2.5 py-4 rounded-2xl border border-border bg-surface-2 font-semibold text-[12.5px] text-center hover:border-primary hover:bg-primary-50 hover:-translate-y-0.5 hover:shadow-card-md transition-all">
          <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.cls}`}>
            <a.icon className="w-[19px] h-[19px]" />
          </span>
          {a.label}
        </button>
      ))}
    </div>
  );
}
