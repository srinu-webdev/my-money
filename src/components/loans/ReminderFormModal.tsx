"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Send } from "lucide-react";
import { useModal } from "@/components/providers/ModalProvider";
import { ModalHeader, ModalBody, ModalFooter, FormError } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormGroup, Select, Textarea } from "@/components/ui/Field";
import { PillTabs } from "@/components/ui/Tabs";
import { sendReminderAction } from "@/lib/actions/reminders";
import { getReminderContextAction } from "@/lib/actions/options";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import type { Loan, LoanBalance } from "@/lib/types";

type ReminderType = "due" | "overdue" | "general";
type Channel = "SMS" | "WhatsApp" | "Email";

function templates(customerName: string, businessName: string, loan: Loan, bal: LoanBalance) {
  return {
    due: `Dear ${customerName}, your payment of ${formatCurrency(bal.totalOutstanding)} for loan ${loan.id} is due on ${formatDate(loan.dueDate)}. Please pay on time to avoid extra interest. — ${businessName}`,
    overdue: `Dear ${customerName}, your loan ${loan.id} is overdue by ${bal.daysOverdue} day${bal.daysOverdue === 1 ? "" : "s"}. Outstanding: ${formatCurrency(bal.totalOutstanding)} (interest ${formatCurrency(bal.interestRemaining)}). Please clear it immediately. — ${businessName}`,
    general: `Dear ${customerName}, this is a message from ${businessName} regarding your loan ${loan.id}. Please contact us for details.`,
  };
}

export function ReminderFormModal({ loan, balance, customerName, businessName, defaultType }: { loan: Loan; balance: LoanBalance; customerName: string; businessName: string; defaultType?: ReminderType }) {
  const { closeModal } = useModal();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const msgs = templates(customerName, businessName, loan, balance);
  const [type, setType] = useState<ReminderType>(defaultType ?? (balance.daysOverdue > 0 ? "overdue" : "due"));
  const [channel, setChannel] = useState<Channel>("SMS");
  const [message, setMessage] = useState(msgs[type]);

  function changeType(t: ReminderType) {
    setType(t);
    setMessage(msgs[t]);
  }

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await sendReminderAction({ loanId: loan.id, type, channel, message: String(formData.get("message")) });
      if (!res.ok) return setError(res.error);
      closeModal();
      router.refresh();
      toast.info("Reminder sent successfully");
    });
  }

  return (
    <form action={submit}>
      <ModalHeader title="Send Reminder" sub={`${customerName} · ${loan.id}`} onClose={closeModal} />
      <ModalBody>
        <div className="flex flex-col gap-4">
          <FormGroup label="Reminder Type">
            <Select value={type} onChange={(e) => changeType(e.target.value as ReminderType)}>
              <option value="due">Payment Due</option>
              <option value="overdue">Overdue Payment</option>
              <option value="general">General</option>
            </Select>
          </FormGroup>
          <FormGroup label="Channel">
            <PillTabs tabs={[{ key: "SMS", label: "SMS" }, { key: "WhatsApp", label: "WhatsApp" }, { key: "Email", label: "Email" }]} active={channel} onChange={(k) => setChannel(k as Channel)} />
          </FormGroup>
          <FormGroup label="Message" hint="Prototype: the message is logged, not actually sent.">
            <Textarea name="message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
          </FormGroup>
        </div>
        <FormError message={error} />
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={closeModal}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          <Send /> Send Reminder
        </Button>
      </ModalFooter>
    </form>
  );
}

export function useReminderModal() {
  const { openModal } = useModal();
  return (args: { loan: Loan; balance: LoanBalance; customerName: string; businessName: string; defaultType?: ReminderType }) => openModal(<ReminderFormModal {...args} />, { size: "md" });
}

/** Fetches loan/balance/customer/business context on demand, then opens the reminder modal — for use anywhere only a loanId is at hand (tables, quick actions). */
export function useSendReminder() {
  const open = useReminderModal();
  return async (loanId: string, defaultType?: ReminderType) => {
    const ctx = await getReminderContextAction(loanId);
    if (!ctx) return toast.error("Loan not found");
    open({ ...ctx, defaultType });
  };
}

export function SendReminderButton({ loanId, variant = "secondary", iconOnly = false }: { loanId: string; variant?: "primary" | "secondary" | "ghost"; iconOnly?: boolean }) {
  const send = useSendReminder();
  const [pending, startTransition] = useTransition();
  return (
    <Button variant={variant} size={iconOnly ? "icon" : "md"} loading={pending} onClick={() => startTransition(() => send(loanId))} title="Send reminder">
      <Send /> {iconOnly ? null : "Reminder"}
    </Button>
  );
}
