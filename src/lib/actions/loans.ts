"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminId } from "@/lib/auth";
import { loanSchema } from "@/lib/validations";
import { nextId } from "@/lib/ids";
import { logActivity, pushNotification } from "@/lib/log";
import { calculateLoanBalance } from "@/lib/calculations";
import { isoToDbDate, serializeLoan, serializePayment } from "@/lib/serialize";
import { todayStr } from "@/lib/dates";
import type { ActionResult } from "@/lib/types";

function refresh() {
  // See customers.ts refresh() — revalidating the root layout covers
  // every nested page, including dynamic /loans/[id] and /customers/[id].
  revalidatePath("/", "layout");
}

export async function createLoanAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdminId();
  const parsed = loanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const customer = await prisma.customer.findUnique({ where: { id: d.customerId } });
  if (!customer) return { ok: false, error: "Please select a valid customer." };

  const loan = await prisma.$transaction(async (tx) => {
    const id = await nextId(tx, "loan");
    const l = await tx.loan.create({
      data: {
        id,
        customerId: d.customerId,
        principal: d.principal,
        interestRate: d.interestRate,
        interestType: d.interestType,
        interestFrequency: d.interestFrequency,
        startDate: isoToDbDate(d.startDate),
        dueDate: isoToDbDate(d.dueDate),
        repaymentType: d.repaymentType,
        notes: d.notes || null,
      },
    });
    await logActivity(tx, "loan_created", `New loan of ₹${d.principal.toLocaleString("en-IN")} created for ${customer.name}`, {
      customerId: d.customerId,
      loanId: l.id,
    });
    await pushNotification(tx, "loan", `New loan ${l.id} of ₹${d.principal.toLocaleString("en-IN")} created for ${customer.name}`);
    return l;
  });
  refresh();
  return { ok: true, data: { id: loan.id } };
}

export async function updateLoanAction(id: string, input: unknown): Promise<ActionResult> {
  await requireAdminId();
  const parsed = loanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const existing = await prisma.loan.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Loan not found." };
  const customer = await prisma.customer.findUnique({ where: { id: d.customerId } });
  if (!customer) return { ok: false, error: "Please select a valid customer." };

  await prisma.$transaction(async (tx) => {
    await tx.loan.update({
      where: { id },
      data: {
        customerId: d.customerId,
        principal: d.principal,
        interestRate: d.interestRate,
        interestType: d.interestType,
        interestFrequency: d.interestFrequency,
        startDate: isoToDbDate(d.startDate),
        dueDate: isoToDbDate(d.dueDate),
        repaymentType: d.repaymentType,
        notes: d.notes || null,
        // Editing the terms of a previously-closed loan back into having a
        // balance reopens it — status is re-derived on next read anyway,
        // but keep the stored flag consistent for the few places that
        // read it directly (e.g. bulk filters).
        ...(existing.status === "PAID" ? { status: "ACTIVE" as const } : {}),
      },
    });
    if (existing.customerId !== d.customerId) {
      await tx.payment.updateMany({ where: { loanId: id }, data: { customerId: d.customerId } });
    }
    await logActivity(tx, "loan_edited", `Loan ${id} updated`, { customerId: d.customerId, loanId: id });
  });
  refresh();
  return { ok: true, data: undefined };
}

export async function deleteLoanAction(id: string): Promise<ActionResult> {
  await requireAdminId();
  const loan = await prisma.loan.findUnique({ where: { id } });
  if (!loan) return { ok: false, error: "Loan not found." };
  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: loan.customerId } });
    await tx.loan.delete({ where: { id } }); // cascades to payments
    await logActivity(tx, "loan_deleted", `Loan ${id} (₹${loan.principal.toString()}) for ${customer?.name ?? "customer"} deleted`, {
      customerId: loan.customerId,
      loanId: id,
    });
  });
  refresh();
  return { ok: true, data: undefined };
}

export async function closeLoanAction(id: string): Promise<ActionResult> {
  await requireAdminId();
  const loan = await prisma.loan.findUnique({ where: { id } });
  if (!loan) return { ok: false, error: "Loan not found." };
  const payments = await prisma.payment.findMany({ where: { loanId: id } });
  const bal = calculateLoanBalance(serializeLoan(loan), payments.map(serializePayment));
  if (bal.totalOutstanding > 1) {
    return {
      ok: false,
      error: `This loan still has an outstanding balance of ₹${bal.totalOutstanding.toLocaleString("en-IN")}. Please collect the remaining amount before closing the loan.`,
    };
  }
  await prisma.$transaction(async (tx) => {
    await tx.loan.update({ where: { id }, data: { status: "PAID" } });
    await logActivity(tx, "loan_closed", `Loan ${id} closed — fully paid`, { customerId: loan.customerId, loanId: id });
    await pushNotification(tx, "paid", `Loan ${id} fully paid and closed`);
  });
  refresh();
  return { ok: true, data: undefined };
}

export async function cancelLoanAction(id: string): Promise<ActionResult> {
  await requireAdminId();
  const loan = await prisma.loan.findUnique({ where: { id } });
  if (!loan) return { ok: false, error: "Loan not found." };
  await prisma.$transaction(async (tx) => {
    await tx.loan.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: isoToDbDate(todayStr()) } });
    await logActivity(tx, "loan_cancelled", `Loan ${id} cancelled`, { customerId: loan.customerId, loanId: id });
  });
  refresh();
  return { ok: true, data: undefined };
}

export async function reactivateLoanAction(id: string): Promise<ActionResult> {
  await requireAdminId();
  const loan = await prisma.loan.findUnique({ where: { id } });
  if (!loan) return { ok: false, error: "Loan not found." };
  await prisma.$transaction(async (tx) => {
    await tx.loan.update({ where: { id }, data: { status: "ACTIVE", cancelledAt: null } });
    await logActivity(tx, "loan_edited", `Loan ${id} reactivated`, { customerId: loan.customerId, loanId: id });
  });
  refresh();
  return { ok: true, data: undefined };
}

export async function bulkDeleteLoansAction(ids: string[]): Promise<ActionResult<{ count: number }>> {
  await requireAdminId();
  if (!ids.length) return { ok: true, data: { count: 0 } };
  await prisma.$transaction(async (tx) => {
    await tx.loan.deleteMany({ where: { id: { in: ids } } }); // cascades to payments
    await logActivity(tx, "loan_deleted", `${ids.length} loan(s) deleted in bulk`);
  });
  refresh();
  return { ok: true, data: { count: ids.length } };
}
