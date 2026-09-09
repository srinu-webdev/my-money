"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminId } from "@/lib/auth";
import { disbursementSchema, loanSchema } from "@/lib/validations";
import { nextId } from "@/lib/ids";
import { logActivity, pushNotification } from "@/lib/log";
import { calculateLoanBalance } from "@/lib/calculations";
import { isoToDbDate, serializeDisbursement, serializeLoan, serializePayment } from "@/lib/serialize";
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

  // Default: the full agreed amount is handed over on day one — this is
  // the common case and matches every loan created before disbursement
  // tranches existed. Only when `initialDisbursement` is set lower does
  // the loan start out partially disbursed (the rest added later via
  // "Add Disbursement" on the loan detail page).
  const initialDisbursed = d.initialDisbursement ?? d.principal;

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
    if (initialDisbursed > 0) {
      const disId = await nextId(tx, "disbursement");
      await tx.disbursement.create({
        data: { id: disId, loanId: l.id, amount: initialDisbursed, date: isoToDbDate(d.startDate), notes: "Initial disbursement" },
      });
    }
    await logActivity(tx, "loan_created", `New loan of ₹${d.principal.toLocaleString("en-IN")} created for ${customer.name}`, {
      customerId: d.customerId,
      loanId: l.id,
    });
    const disbursedNote =
      initialDisbursed < d.principal
        ? ` (₹${initialDisbursed.toLocaleString("en-IN")} disbursed now, ₹${(d.principal - initialDisbursed).toLocaleString("en-IN")} pending)`
        : "";
    await pushNotification(
      tx,
      "loan",
      `New loan ${l.id} of ₹${d.principal.toLocaleString("en-IN")} created for ${customer.name}${disbursedNote}`,
    );
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
  const [payments, disbursements] = await Promise.all([
    prisma.payment.findMany({ where: { loanId: id } }),
    prisma.disbursement.findMany({ where: { loanId: id } }),
  ]);
  const bal = calculateLoanBalance(serializeLoan(loan), payments.map(serializePayment), undefined, disbursements.map(serializeDisbursement));
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

// ---- Disbursement tranches ----
// Records a later hand-over of cash against a loan whose full agreed
// principal wasn't given out on day one. Interest only ever accrues on
// what's actually been disbursed — see calculateInterestForLoan — so
// this is the only correct way to add money to a loan after creation
// (never edit `principal` on an already-active loan for that purpose).

export async function addDisbursementAction(loanId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdminId();
  const parsed = disbursementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) return { ok: false, error: "Loan not found." };
  if (loan.status === "CANCELLED") return { ok: false, error: "This loan is cancelled — it can't receive further disbursements." };
  if (d.date < loan.startDate.toISOString().slice(0, 10)) {
    return { ok: false, error: "Disbursement date can't be before the loan's start date." };
  }

  const existing = await prisma.disbursement.findMany({ where: { loanId } });
  const totalDisbursed = existing.reduce((sum, x) => sum + x.amount.toNumber(), 0);
  const pending = loan.principal.toNumber() - totalDisbursed;
  if (d.amount > pending + 0.01) {
    return {
      ok: false,
      error: `Only ₹${pending.toLocaleString("en-IN")} of the ₹${loan.principal.toNumber().toLocaleString("en-IN")} agreed amount is still pending. Increase the loan amount first if more needs to be given.`,
    };
  }

  const customer = await prisma.customer.findUnique({ where: { id: loan.customerId } });

  const disbursement = await prisma.$transaction(async (tx) => {
    const id = await nextId(tx, "disbursement");
    const row = await tx.disbursement.create({
      data: { id, loanId, amount: d.amount, date: isoToDbDate(d.date), notes: d.notes || null },
    });
    // A loan that had been fully disbursed and is being topped back up
    // should read as active again, not still show as paid/closed.
    if (loan.status === "PAID") {
      await tx.loan.update({ where: { id: loanId }, data: { status: "ACTIVE" } });
    }
    await logActivity(tx, "loan_edited", `₹${d.amount.toLocaleString("en-IN")} disbursed on loan ${loanId} for ${customer?.name ?? "customer"}`, {
      customerId: loan.customerId,
      loanId,
    });
    return row;
  });
  refresh();
  return { ok: true, data: { id: disbursement.id } };
}

export async function deleteDisbursementAction(disbursementId: string): Promise<ActionResult> {
  await requireAdminId();
  const row = await prisma.disbursement.findUnique({ where: { id: disbursementId } });
  if (!row) return { ok: false, error: "Disbursement not found." };
  const loan = await prisma.loan.findUnique({ where: { id: row.loanId } });
  await prisma.$transaction(async (tx) => {
    await tx.disbursement.delete({ where: { id: disbursementId } });
    await logActivity(tx, "loan_edited", `Disbursement of ₹${row.amount.toString()} removed from loan ${row.loanId}`, {
      customerId: loan?.customerId,
      loanId: row.loanId,
    });
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
