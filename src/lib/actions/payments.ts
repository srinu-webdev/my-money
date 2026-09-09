"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminId, getSessionPayload } from "@/lib/auth";
import { paymentSchema } from "@/lib/validations";
import { nextId } from "@/lib/ids";
import { logActivity, pushNotification } from "@/lib/log";
import { calculateLoanBalance, computeAllocation } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";
import { isoToDbDate, serializeDisbursement, serializeLoan, serializePayment } from "@/lib/serialize";
import { businessNow, parseDate } from "@/lib/dates";
import type { ActionResult, Disbursement, Loan, Payment } from "@/lib/types";

type Tx = Prisma.TransactionClient;

function refresh() {
  // See customers.ts refresh().
  revalidatePath("/", "layout");
}

/** Auto-close a loan once fully paid; auto-reopen if a payment edit/delete undoes that. */
async function syncLoanStatusAfterPaymentChange(tx: Tx, loanId: string) {
  const loanRow = await tx.loan.findUnique({ where: { id: loanId } });
  if (!loanRow || loanRow.status === "CANCELLED") return;
  const [payments, disbursements] = await Promise.all([
    tx.payment.findMany({ where: { loanId } }),
    tx.disbursement.findMany({ where: { loanId } }),
  ]);
  const loan = serializeLoan(loanRow);
  const bal = calculateLoanBalance(loan, payments.map(serializePayment), undefined, disbursements.map(serializeDisbursement));
  if (bal.totalOutstanding <= 1 && loanRow.status !== "PAID") {
    await tx.loan.update({ where: { id: loanId }, data: { status: "PAID" } });
    await logActivity(tx, "loan_paid", `Loan ${loanId} fully paid`, { customerId: loanRow.customerId, loanId });
    await pushNotification(tx, "paid", `Loan ${loanId} fully paid by ${(await tx.customer.findUnique({ where: { id: loanRow.customerId } }))?.name ?? "customer"}`);
  } else if (bal.totalOutstanding > 1 && loanRow.status === "PAID") {
    await tx.loan.update({ where: { id: loanId }, data: { status: "ACTIVE" } });
  }
}

function validateAllocation(
  loan: Loan,
  existing: Payment[],
  amount: number,
  allocation: string,
  customInterest: number | undefined,
  customPrincipal: number | undefined,
  paymentDate: string,
  disbursements: Disbursement[]
): string | null {
  const a = computeAllocation(
    loan,
    existing,
    amount,
    allocation as "interest" | "principal" | "interest_principal" | "custom",
    { interestAmount: customInterest, principalAmount: customPrincipal },
    paymentDate,
    disbursements
  );
  if (allocation === "custom") {
    if (a.interestAmount < 0 || a.principalAmount < 0) return "Allocation amounts cannot be negative.";
    if (Math.abs(a.interestAmount + a.principalAmount - amount) > 0.01) return "Interest + Principal must equal the payment amount.";
    if (a.principalAmount > a.principalRemaining + 0.01) {
      return `Principal portion (${formatCurrency(a.principalAmount)}) exceeds principal outstanding (${formatCurrency(a.principalRemaining)}).`;
    }
  } else {
    if (a.interestAmount + a.principalAmount <= 0) return "Nothing is outstanding for the selected allocation. Choose a different allocation.";
    if (a.unallocated > 0.01) return `Payment exceeds the outstanding balance by ${formatCurrency(a.unallocated)}. Reduce the amount or use a custom split.`;
  }
  return null;
}

export async function createPaymentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdminId();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const loanRow = await prisma.loan.findUnique({ where: { id: d.loanId } });
  if (!loanRow) return { ok: false, error: "Please select a valid loan." };
  if (loanRow.status === "CANCELLED") return { ok: false, error: "This loan is cancelled." };
  const loan = serializeLoan(loanRow);
  if (parseDate(d.paymentDate) > businessNow()) return { ok: false, error: "Payment date cannot be in the future." };
  if (parseDate(d.paymentDate) < parseDate(loan.startDate)) {
    return { ok: false, error: `Payment date cannot be before the loan start date.` };
  }

  const existing = (await prisma.payment.findMany({ where: { loanId: d.loanId } })).map(serializePayment);
  const disbursements = (await prisma.disbursement.findMany({ where: { loanId: d.loanId } })).map(serializeDisbursement);
  const err = validateAllocation(loan, existing, d.amount, d.allocation, d.customInterest, d.customPrincipal, d.paymentDate, disbursements);
  if (err) return { ok: false, error: err };

  const a = computeAllocation(loan, existing, d.amount, d.allocation, { interestAmount: d.customInterest, principalAmount: d.customPrincipal }, d.paymentDate, disbursements);
  const session = await getSessionPayload();
  const admin = session ? await prisma.admin.findUnique({ where: { id: session.adminId } }) : null;
  const customer = await prisma.customer.findUnique({ where: { id: loan.customerId } });

  const payment = await prisma.$transaction(async (tx) => {
    const id = await nextId(tx, "payment");
    const p = await tx.payment.create({
      data: {
        id,
        loanId: d.loanId,
        customerId: loan.customerId,
        amount: a.interestAmount + a.principalAmount,
        interestAmount: a.interestAmount,
        principalAmount: a.principalAmount,
        paymentMethod: d.paymentMethod,
        paymentDate: isoToDbDate(d.paymentDate),
        reference: d.reference || null,
        notes: d.notes || null,
        recordedBy: admin?.name ?? "Admin",
      },
    });
    const name = customer?.name ?? "Customer";
    await logActivity(tx, "payment_recorded", `${name} made a payment of ${formatCurrency(p.amount.toNumber())} (${loan.id})`, {
      customerId: loan.customerId,
      loanId: loan.id,
      paymentId: p.id,
    });
    await pushNotification(tx, "payment", `Payment of ${formatCurrency(p.amount.toNumber())} received from ${name}`);
    await syncLoanStatusAfterPaymentChange(tx, d.loanId);
    return p;
  });
  refresh();
  return { ok: true, data: { id: payment.id } };
}

export async function updatePaymentAction(id: string, input: unknown): Promise<ActionResult> {
  await requireAdminId();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const existingPayment = await prisma.payment.findUnique({ where: { id } });
  if (!existingPayment) return { ok: false, error: "Payment not found." };

  const loanRow = await prisma.loan.findUnique({ where: { id: d.loanId } });
  if (!loanRow) return { ok: false, error: "Please select a valid loan." };
  const loan = serializeLoan(loanRow);
  if (parseDate(d.paymentDate) > businessNow()) return { ok: false, error: "Payment date cannot be in the future." };

  const others = (await prisma.payment.findMany({ where: { loanId: d.loanId, id: { not: id } } })).map(serializePayment);
  const disbursements = (await prisma.disbursement.findMany({ where: { loanId: d.loanId } })).map(serializeDisbursement);
  const err = validateAllocation(loan, others, d.amount, d.allocation, d.customInterest, d.customPrincipal, d.paymentDate, disbursements);
  if (err) return { ok: false, error: err };
  const a = computeAllocation(loan, others, d.amount, d.allocation, { interestAmount: d.customInterest, principalAmount: d.customPrincipal }, d.paymentDate, disbursements);

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id },
      data: {
        loanId: d.loanId,
        customerId: loan.customerId,
        amount: a.interestAmount + a.principalAmount,
        interestAmount: a.interestAmount,
        principalAmount: a.principalAmount,
        paymentMethod: d.paymentMethod,
        paymentDate: isoToDbDate(d.paymentDate),
        reference: d.reference || null,
        notes: d.notes || null,
      },
    });
    await logActivity(tx, "payment_edited", `Payment ${id} updated to ${formatCurrency(a.interestAmount + a.principalAmount)}`, {
      customerId: loan.customerId,
      loanId: loan.id,
      paymentId: id,
    });
    if (existingPayment.loanId !== d.loanId) await syncLoanStatusAfterPaymentChange(tx, existingPayment.loanId);
    await syncLoanStatusAfterPaymentChange(tx, d.loanId);
  });
  refresh();
  return { ok: true, data: undefined };
}

export async function deletePaymentAction(id: string): Promise<ActionResult> {
  await requireAdminId();
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return { ok: false, error: "Payment not found." };
  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: payment.customerId } });
    await tx.payment.delete({ where: { id } });
    await logActivity(tx, "payment_deleted", `Payment ${id} of ${formatCurrency(payment.amount.toNumber())} for ${customer?.name ?? "customer"} deleted`, {
      customerId: payment.customerId,
      loanId: payment.loanId,
      paymentId: id,
    });
    await syncLoanStatusAfterPaymentChange(tx, payment.loanId);
  });
  refresh();
  return { ok: true, data: undefined };
}

export async function bulkDeletePaymentsAction(ids: string[]): Promise<ActionResult<{ count: number }>> {
  await requireAdminId();
  if (!ids.length) return { ok: true, data: { count: 0 } };
  const payments = await prisma.payment.findMany({ where: { id: { in: ids } } });
  const loanIds = [...new Set(payments.map((p) => p.loanId))];
  await prisma.$transaction(async (tx) => {
    await tx.payment.deleteMany({ where: { id: { in: ids } } });
    await logActivity(tx, "payment_deleted", `${ids.length} payment(s) deleted in bulk`);
    for (const loanId of loanIds) await syncLoanStatusAfterPaymentChange(tx, loanId);
  });
  refresh();
  return { ok: true, data: { count: ids.length } };
}
