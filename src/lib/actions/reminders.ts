"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminId } from "@/lib/auth";
import { reminderSchema } from "@/lib/validations";
import { logActivity, pushNotification } from "@/lib/log";
import { calculateLoanBalance, getLoanStatus } from "@/lib/calculations";
import { serializeLoan, serializePayment } from "@/lib/serialize";
import type { ActionResult } from "@/lib/types";

// TODO(production): connect a real SMS / WhatsApp / Email provider here
// (Twilio, MSG91, Gupshup, SendGrid...). For now the message is only
// logged to the activity feed and a notification is raised, matching
// this prototype's other simulated integrations.

export async function sendReminderAction(input: unknown): Promise<ActionResult> {
  await requireAdminId();
  const parsed = reminderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const loan = await prisma.loan.findUnique({ where: { id: d.loanId } });
  if (!loan) return { ok: false, error: "Loan not found." };
  const customer = await prisma.customer.findUnique({ where: { id: loan.customerId } });
  const label = d.type === "overdue" ? "Overdue" : d.type === "due" ? "Due" : "General";
  await prisma.$transaction(async (tx) => {
    await logActivity(tx, "reminder_sent", `${label} reminder sent to ${customer?.name ?? "customer"} via ${d.channel} (${loan.id})`, {
      customerId: loan.customerId,
      loanId: loan.id,
    });
    await pushNotification(tx, "reminder", `Reminder sent to ${customer?.name ?? "customer"} for ${loan.id} via ${d.channel}`);
  });
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function remindAllOverdueAction(): Promise<ActionResult<{ count: number }>> {
  await requireAdminId();
  const [loans, payments, customers] = await Promise.all([prisma.loan.findMany(), prisma.payment.findMany(), prisma.customer.findMany()]);
  const byLoan = new Map<string, typeof payments>();
  for (const p of payments) {
    const arr = byLoan.get(p.loanId) ?? [];
    arr.push(p);
    byLoan.set(p.loanId, arr);
  }
  const nameOf = new Map(customers.map((c) => [c.id, c.name]));
  const overdue = loans.filter((l) => {
    const loan = serializeLoan(l);
    const bal = calculateLoanBalance(loan, (byLoan.get(l.id) ?? []).map(serializePayment));
    return getLoanStatus(loan, bal) === "OVERDUE";
  });
  if (!overdue.length) return { ok: true, data: { count: 0 } };
  await prisma.$transaction(async (tx) => {
    for (const l of overdue) {
      await logActivity(tx, "reminder_sent", `Overdue reminder sent to ${nameOf.get(l.customerId) ?? "customer"} via SMS (${l.id})`, {
        customerId: l.customerId,
        loanId: l.id,
      });
    }
    await pushNotification(tx, "reminder", `${overdue.length} overdue reminder(s) sent`);
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { count: overdue.length } };
}
