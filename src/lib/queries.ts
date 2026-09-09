import "server-only";
import { prisma } from "./db";
import { getSessionPayload } from "./auth";
import {
  serializeActivity,
  serializeAdmin,
  serializeCustomer,
  serializeDisbursement,
  serializeLoan,
  serializeNotification,
  serializePayment,
  serializeSettings,
} from "./serialize";
import type { Activity, AdminProfile, Customer, Disbursement, Loan, Notification, Payment, Settings } from "./types";
import { calculateCustomerSummary, calculateLoanBalance, getDashboardStats, getLoanStatus } from "./calculations";
import { todayStr } from "./dates";
import type { CustomerSummary, DashboardStats, LoanBalance, LoanStatus } from "./types";

// Read-side data access for Server Components. Every function here is a
// thin, cached-per-request wrapper around Prisma — mutations live in
// lib/actions/*.ts as Server Actions, which call revalidatePath() so
// these reads pick up fresh data on the next render.

export async function getCurrentAdmin(): Promise<AdminProfile | null> {
  const session = await getSessionPayload();
  if (!session) return null;
  const admin = await prisma.admin.findUnique({ where: { id: session.adminId } });
  return admin ? serializeAdmin(admin) : null;
}

export async function getAllCustomers(): Promise<Customer[]> {
  const rows = await prisma.customer.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(serializeCustomer);
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const row = await prisma.customer.findUnique({ where: { id } });
  return row ? serializeCustomer(row) : null;
}

export async function getAllLoans(): Promise<Loan[]> {
  const rows = await prisma.loan.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(serializeLoan);
}

export async function getLoanById(id: string): Promise<Loan | null> {
  const row = await prisma.loan.findUnique({ where: { id } });
  return row ? serializeLoan(row) : null;
}

export async function getLoansByCustomer(customerId: string): Promise<Loan[]> {
  const rows = await prisma.loan.findMany({ where: { customerId }, orderBy: { startDate: "desc" } });
  return rows.map(serializeLoan);
}

export async function getAllPayments(): Promise<Payment[]> {
  const rows = await prisma.payment.findMany({ orderBy: { paymentDate: "desc" } });
  return rows.map(serializePayment);
}

export async function getPaymentsByLoan(loanId: string): Promise<Payment[]> {
  const rows = await prisma.payment.findMany({ where: { loanId }, orderBy: { paymentDate: "desc" } });
  return rows.map(serializePayment);
}

export async function getPaymentsByCustomer(customerId: string): Promise<Payment[]> {
  const rows = await prisma.payment.findMany({ where: { customerId }, orderBy: { paymentDate: "desc" } });
  return rows.map(serializePayment);
}

export async function getPaymentById(id: string): Promise<Payment | null> {
  const row = await prisma.payment.findUnique({ where: { id } });
  return row ? serializePayment(row) : null;
}

export async function getAllDisbursements(): Promise<Disbursement[]> {
  const rows = await prisma.disbursement.findMany({ orderBy: { date: "asc" } });
  return rows.map(serializeDisbursement);
}

export async function getDisbursementsByLoan(loanId: string): Promise<Disbursement[]> {
  const rows = await prisma.disbursement.findMany({ where: { loanId }, orderBy: { date: "asc" } });
  return rows.map(serializeDisbursement);
}

function groupByLoan<T extends { loanId: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const arr = m.get(r.loanId) ?? [];
    arr.push(r);
    m.set(r.loanId, arr);
  }
  return m;
}

export async function getAllNotifications(): Promise<Notification[]> {
  const rows = await prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  return rows.map(serializeNotification);
}

export async function getUnreadNotificationCount(): Promise<number> {
  return prisma.notification.count({ where: { read: false } });
}

export async function getRecentActivities(limit = 50): Promise<Activity[]> {
  const rows = await prisma.activity.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  return rows.map(serializeActivity);
}

export async function getActivitiesFor(opts: { customerId?: string; loanId?: string }, limit = 50): Promise<Activity[]> {
  const rows = await prisma.activity.findMany({
    where: { OR: [opts.customerId ? { customerId: opts.customerId } : {}, opts.loanId ? { loanId: opts.loanId } : {}].filter((w) => Object.keys(w).length) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(serializeActivity);
}

export async function getSettings(): Promise<Settings> {
  const row = await prisma.settings.findUnique({ where: { id: 1 } });
  if (row) return serializeSettings(row);
  // First run before the seed script has ever executed — fall back to sane defaults.
  return {
    businessName: "LendPro Financial Services",
    businessPhone: "",
    businessEmail: "",
    businessAddress: "",
    currency: "INR",
    dateFormat: "DD/MM/YYYY",
    defaultInterestRate: 2,
    defaultInterestType: "PERCENTAGE",
    defaultFrequency: "MONTHLY",
    defaultRepaymentType: "Interest Only",
    defaultPaymentMethod: "Cash",
    dueReminder: true,
    overdueReminder: true,
  };
}

// ---- Derived/aggregate reads (fetch once, compute with lib/calculations) ----

export interface LoanRow extends Loan {
  balance: LoanBalance;
  derivedStatus: LoanStatus;
}

export async function getAllLoansWithBalance(): Promise<LoanRow[]> {
  const [loans, payments, disbursements] = await Promise.all([getAllLoans(), getAllPayments(), getAllDisbursements()]);
  const paymentsByLoan = groupByLoan(payments);
  const disbursementsByLoan = groupByLoan(disbursements);
  return loans.map((loan) => {
    const balance = calculateLoanBalance(loan, paymentsByLoan.get(loan.id) ?? [], undefined, disbursementsByLoan.get(loan.id));
    return { ...loan, balance, derivedStatus: getLoanStatus(loan, balance) };
  });
}

export async function getLoanWithBalance(id: string): Promise<LoanRow | null> {
  const loan = await getLoanById(id);
  if (!loan) return null;
  const [payments, disbursements] = await Promise.all([getPaymentsByLoan(id), getDisbursementsByLoan(id)]);
  const balance = calculateLoanBalance(loan, payments, undefined, disbursements);
  return { ...loan, balance, derivedStatus: getLoanStatus(loan, balance) };
}

export interface CustomerRow extends Customer {
  summary: CustomerSummary;
}

export async function getAllCustomersWithSummary(): Promise<CustomerRow[]> {
  const [customers, loans, payments, disbursements] = await Promise.all([getAllCustomers(), getAllLoans(), getAllPayments(), getAllDisbursements()]);
  const loansByCustomer = new Map<string, Loan[]>();
  for (const l of loans) {
    const arr = loansByCustomer.get(l.customerId) ?? [];
    arr.push(l);
    loansByCustomer.set(l.customerId, arr);
  }
  const paymentsByLoan = groupByLoan(payments);
  const disbursementsByLoan = groupByLoan(disbursements);
  return customers.map((c) => ({
    ...c,
    summary: calculateCustomerSummary(loansByCustomer.get(c.id) ?? [], paymentsByLoan, disbursementsByLoan),
  }));
}

export async function getCustomerWithSummary(id: string): Promise<CustomerRow | null> {
  const customer = await getCustomerById(id);
  if (!customer) return null;
  const loans = await getLoansByCustomer(id);
  const [payments, disbursements] = await Promise.all([getPaymentsByCustomer(id), getAllDisbursements()]);
  const paymentsByLoan = groupByLoan(payments);
  const loanIds = new Set(loans.map((l) => l.id));
  const disbursementsByLoan = groupByLoan(disbursements.filter((d) => loanIds.has(d.loanId)));
  return { ...customer, summary: calculateCustomerSummary(loans, paymentsByLoan, disbursementsByLoan) };
}

export async function getDashboardData(): Promise<DashboardStats> {
  const [loans, payments, disbursements, customerCount] = await Promise.all([getAllLoans(), getAllPayments(), getAllDisbursements(), prisma.customer.count()]);
  return getDashboardStats(loans, payments, customerCount, todayStr(), groupByLoan(disbursements));
}
