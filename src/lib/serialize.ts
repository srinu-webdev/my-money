import type { Customer as PCustomer, Loan as PLoan, Payment as PPayment, Notification as PNotification, Activity as PActivity, Settings as PSettings, Admin as PAdmin } from "@prisma/client";
import type { Customer, Loan, Payment, Notification, Activity, Settings, AdminProfile } from "./types";

// Prisma returns `@db.Date` columns as a Date object at UTC midnight for
// that calendar day. Reading it back with LOCAL getters would shift the
// date by one day in any negative-UTC time zone — so this always reads
// via the UTC getters, matching how it was written.
function dbDateToISO(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function serializeCustomer(c: PCustomer): Customer {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    city: c.city,
    state: c.state,
    postalCode: c.postalCode,
    notes: c.notes,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function serializeLoan(l: PLoan): Loan {
  return {
    id: l.id,
    customerId: l.customerId,
    principal: l.principal.toNumber(),
    interestRate: l.interestRate.toNumber(),
    interestType: l.interestType,
    interestFrequency: l.interestFrequency,
    startDate: dbDateToISO(l.startDate),
    dueDate: dbDateToISO(l.dueDate),
    repaymentType: l.repaymentType,
    status: l.status,
    cancelledAt: l.cancelledAt ? dbDateToISO(l.cancelledAt) : null,
    notes: l.notes,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

export function serializePayment(p: PPayment): Payment {
  return {
    id: p.id,
    loanId: p.loanId,
    customerId: p.customerId,
    amount: p.amount.toNumber(),
    interestAmount: p.interestAmount.toNumber(),
    principalAmount: p.principalAmount.toNumber(),
    paymentMethod: p.paymentMethod,
    paymentDate: dbDateToISO(p.paymentDate),
    reference: p.reference,
    notes: p.notes,
    recordedBy: p.recordedBy,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function serializeNotification(n: PNotification): Notification {
  return { id: n.id, type: n.type, message: n.message, read: n.read, createdAt: n.createdAt.toISOString() };
}

export function serializeActivity(a: PActivity): Activity {
  return {
    id: a.id,
    type: a.type,
    description: a.description,
    customerId: a.customerId,
    loanId: a.loanId,
    paymentId: a.paymentId,
    createdAt: a.createdAt.toISOString(),
  };
}

export function serializeSettings(s: PSettings): Settings {
  return {
    businessName: s.businessName,
    businessPhone: s.businessPhone,
    businessEmail: s.businessEmail,
    businessAddress: s.businessAddress,
    currency: s.currency,
    dateFormat: s.dateFormat,
    defaultInterestRate: s.defaultInterestRate.toNumber(),
    defaultInterestType: s.defaultInterestType,
    defaultFrequency: s.defaultFrequency,
    defaultRepaymentType: s.defaultRepaymentType,
    defaultPaymentMethod: s.defaultPaymentMethod,
    dueReminder: s.dueReminder,
    overdueReminder: s.overdueReminder,
  };
}

export function serializeAdmin(a: PAdmin): AdminProfile {
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    phone: a.phone,
    avatar: a.avatar,
    role: a.role,
    createdAt: a.createdAt.toISOString(),
  };
}

// `@db.Date` columns must be written as a UTC-midnight Date for a given
// "YYYY-MM-DD" string, the exact inverse of dbDateToISO above.
export function isoToDbDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
