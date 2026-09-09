"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminId } from "@/lib/auth";
import { customerSchema } from "@/lib/validations";
import { nextId } from "@/lib/ids";
import { logActivity, pushNotification } from "@/lib/log";
import { calculateLoanBalance, getLoanStatus } from "@/lib/calculations";
import { serializeLoan, serializePayment } from "@/lib/serialize";
import type { ActionResult } from "@/lib/types";

function refresh() {
  // Revalidating the root layout cascades to every nested route (pages
  // AND the (dashboard) layout that renders sidebar badge counts / the
  // notification bell), so a single call keeps the whole shell in sync.
  revalidatePath("/", "layout");
}

/** Loans that are neither fully paid nor cancelled — blocks a delete. */
async function countActiveLoans(customerId: string): Promise<number> {
  const [loans, payments] = await Promise.all([
    prisma.loan.findMany({ where: { customerId } }),
    prisma.payment.findMany({ where: { customerId } }),
  ]);
  const byLoan = new Map<string, typeof payments>();
  for (const p of payments) {
    const arr = byLoan.get(p.loanId) ?? [];
    arr.push(p);
    byLoan.set(p.loanId, arr);
  }
  return loans.filter((l) => {
    const loan = serializeLoan(l);
    const bal = calculateLoanBalance(loan, (byLoan.get(l.id) ?? []).map(serializePayment));
    const st = getLoanStatus(loan, bal);
    return st !== "PAID" && st !== "CANCELLED";
  }).length;
}

export async function createCustomerAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdminId();
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const customer = await prisma.$transaction(async (tx) => {
    const id = await nextId(tx, "customer");
    const c = await tx.customer.create({
      data: {
        id,
        name: d.name,
        phone: d.phone,
        email: d.email || null,
        address: d.address || null,
        city: d.city || null,
        state: d.state || null,
        postalCode: d.postalCode || null,
        notes: d.notes || null,
        status: d.status,
      },
    });
    await logActivity(tx, "customer_created", `New customer ${c.name} added`, { customerId: c.id });
    await pushNotification(tx, "customer", `New customer added: ${c.name}`);
    return c;
  });
  refresh();
  return { ok: true, data: { id: customer.id } };
}

export async function updateCustomerAction(id: string, input: unknown): Promise<ActionResult> {
  await requireAdminId();
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Customer not found." };
  await prisma.$transaction(async (tx) => {
    const c = await tx.customer.update({
      where: { id },
      data: {
        name: d.name,
        phone: d.phone,
        email: d.email || null,
        address: d.address || null,
        city: d.city || null,
        state: d.state || null,
        postalCode: d.postalCode || null,
        notes: d.notes || null,
        status: d.status,
      },
    });
    await logActivity(tx, "customer_edited", `Customer ${c.name} updated`, { customerId: id });
  });
  refresh();
  revalidatePath(`/customers/${id}`);
  return { ok: true, data: undefined };
}

export async function deleteCustomerAction(id: string): Promise<ActionResult> {
  await requireAdminId();
  const active = await countActiveLoans(id);
  if (active > 0) {
    return {
      ok: false,
      error: `This customer has ${active} active loan${active === 1 ? "" : "s"}. Please close or transfer the loans before deleting the customer.`,
    };
  }
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return { ok: false, error: "Customer not found." };
  await prisma.$transaction(async (tx) => {
    await tx.customer.delete({ where: { id } }); // cascades to loans + payments
    await logActivity(tx, "customer_deleted", `Customer ${customer.name} (${id}) deleted`, { customerId: id });
  });
  refresh();
  return { ok: true, data: undefined };
}

export async function setCustomerStatusAction(id: string, status: "ACTIVE" | "INACTIVE"): Promise<ActionResult> {
  await requireAdminId();
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return { ok: false, error: "Customer not found." };
  await prisma.$transaction(async (tx) => {
    await tx.customer.update({ where: { id }, data: { status } });
    await logActivity(tx, "customer_edited", `Customer ${customer.name} marked ${status === "ACTIVE" ? "Active" : "Inactive"}`, { customerId: id });
  });
  refresh();
  return { ok: true, data: undefined };
}

export async function bulkSetCustomerStatusAction(ids: string[], status: "ACTIVE" | "INACTIVE"): Promise<ActionResult<{ count: number }>> {
  await requireAdminId();
  if (!ids.length) return { ok: true, data: { count: 0 } };
  await prisma.$transaction(async (tx) => {
    await tx.customer.updateMany({ where: { id: { in: ids } }, data: { status } });
    await logActivity(tx, "customer_edited", `${ids.length} customer(s) marked ${status === "ACTIVE" ? "Active" : "Inactive"}`);
  });
  refresh();
  return { ok: true, data: { count: ids.length } };
}

export async function bulkDeleteCustomersAction(ids: string[]): Promise<ActionResult<{ deleted: number; blocked: number }>> {
  await requireAdminId();
  if (!ids.length) return { ok: true, data: { deleted: 0, blocked: 0 } };
  const blocked: string[] = [];
  const deletable: string[] = [];
  for (const id of ids) {
    const active = await countActiveLoans(id);
    if (active > 0) blocked.push(id);
    else deletable.push(id);
  }
  if (deletable.length) {
    await prisma.$transaction(async (tx) => {
      await tx.customer.deleteMany({ where: { id: { in: deletable } } });
      await logActivity(tx, "customer_deleted", `${deletable.length} customer(s) deleted in bulk`);
    });
  }
  refresh();
  return { ok: true, data: { deleted: deletable.length, blocked: blocked.length } };
}
