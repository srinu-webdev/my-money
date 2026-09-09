"use server";

// Lightweight, on-demand data for client-opened modals (loan/payment
// forms). Kept separate from lib/queries.ts (which is import "server-only"
// and used directly by Server Components) because Client Components can
// only reach server data through an exported Server Action.

import { requireAdminId } from "@/lib/auth";
import { getAllCustomers, getAllLoansWithBalance, getCustomerById, getLoanById, getPaymentById, getPaymentsByLoan, getSettings } from "@/lib/queries";
import { calculateLoanBalance } from "@/lib/calculations";
import type { Loan, Payment } from "@/lib/types";

export async function getCustomerOptionsAction() {
  await requireAdminId();
  return getAllCustomers();
}

export async function getLoanFormDefaultsAction() {
  await requireAdminId();
  const [customers, settings] = await Promise.all([getAllCustomers(), getSettings()]);
  return { customers, settings };
}

export interface LoanOption {
  loan: Loan;
  outstanding: number;
}

/** Loans for the payment form's dropdown — optionally scoped to one customer, always excluding cancelled loans, including a paid/closed loan only when it's the one currently being edited. */
export async function getLoanOptionsAction(customerId?: string, includeLoanId?: string): Promise<LoanOption[]> {
  await requireAdminId();
  const all = await getAllLoansWithBalance();
  return all
    .filter((l) => (!customerId || l.customerId === customerId) && l.status !== "CANCELLED" && (l.balance.totalOutstanding > 0 || l.id === includeLoanId))
    .map((l) => ({ loan: l as Loan, outstanding: l.balance.totalOutstanding }));
}

/** Loan + its full payment history, for computing a live allocation preview client-side with lib/calculations (no round-trip per keystroke). */
export async function getLoanForPaymentFormAction(loanId: string): Promise<{ loan: Loan; payments: Payment[] } | null> {
  await requireAdminId();
  const loan = await getLoanById(loanId);
  if (!loan) return null;
  const payments = await getPaymentsByLoan(loanId);
  return { loan, payments };
}

/** Everything the reminder modal needs, fetched on demand from wherever a "Send Reminder" button lives. */
export async function getReminderContextAction(loanId: string) {
  await requireAdminId();
  const loan = await getLoanById(loanId);
  if (!loan) return null;
  const [payments, customer, settings] = await Promise.all([getPaymentsByLoan(loanId), getCustomerById(loan.customerId), getSettings()]);
  const balance = calculateLoanBalance(loan, payments);
  return { loan, balance, customerName: customer?.name ?? "Customer", businessName: settings.businessName };
}

/** Everything a printable payment receipt needs beyond the payment row itself. */
export async function getReceiptContextAction(paymentId: string) {
  await requireAdminId();
  const payment = await getPaymentById(paymentId);
  if (!payment) return null;
  const [loan, customer, settings] = await Promise.all([getLoanById(payment.loanId), getCustomerById(payment.customerId), getSettings()]);
  const balance = loan ? calculateLoanBalance(loan, await getPaymentsByLoan(loan.id)) : null;
  return { payment, loan, customerName: customer?.name ?? "Customer", settings, outstandingAfter: balance?.totalOutstanding ?? null };
}
