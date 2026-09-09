// =====================================================================
// Domain types — plain, serializable shapes used everywhere on the
// client. Prisma's generated types use `Decimal` for money and `Date`
// for dates; `lib/serialize.ts` converts a Prisma row into these shapes
// (number + ISO date string) before it ever crosses into a Client
// Component, since Decimal/Date instances are not React-serializable.
// =====================================================================

export type CustomerStatus = "ACTIVE" | "INACTIVE";
export type InterestType = "PERCENTAGE" | "FIXED";
export type InterestFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type LoanStoredStatus = "ACTIVE" | "PAID" | "CANCELLED";
// Overdue / Partially Paid are derived at read time — never stored.
export type LoanStatus = LoanStoredStatus | "OVERDUE" | "PARTIALLY_PAID";
export type PaymentMethod = "Cash" | "UPI" | "Bank Transfer" | "Cheque" | "Other";
export type RepaymentType = "Interest Only" | "Principal + Interest" | "Principal First" | "Daily Installment" | "Custom";
export type AllocationMode = "interest" | "principal" | "interest_principal" | "custom";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  notes: string | null;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  customerId: string;
  principal: number;
  interestRate: number;
  interestType: InterestType;
  interestFrequency: InterestFrequency;
  startDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  repaymentType: string;
  status: LoanStoredStatus;
  cancelledAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  loanId: string;
  customerId: string;
  amount: number;
  interestAmount: number;
  principalAmount: number;
  paymentMethod: string;
  paymentDate: string; // YYYY-MM-DD
  reference: string | null;
  notes: string | null;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

// One actual handover of cash against a loan. Most loans have exactly
// one, auto-created on the loan's start date; a loan disbursed in
// tranches (agreed ₹1,00,000, given ₹50,000 now / ₹50,000 later) has more.
export interface Disbursement {
  id: string;
  loanId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  notes: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Activity {
  id: string;
  type: string;
  description: string;
  customerId: string | null;
  loanId: string | null;
  paymentId: string | null;
  createdAt: string;
}

export interface Settings {
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  currency: string;
  dateFormat: string;
  defaultInterestRate: number;
  defaultInterestType: InterestType;
  defaultFrequency: InterestFrequency;
  defaultRepaymentType: string;
  defaultPaymentMethod: string;
  dueReminder: boolean;
  overdueReminder: boolean;
}

export interface AdminProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  role: string;
  createdAt: string;
}

// ---- Derived, computed-at-read-time shapes ----

export interface LoanBalance {
  principal: number;
  principalPaid: number;
  interestPaid: number;
  principalRemaining: number;
  interestAccrued: number;
  interestRemaining: number;
  totalPaid: number;
  totalOutstanding: number;
  paymentsCount: number;
  lastPaymentDate: string | null;
  lastPaymentAmount: number;
  daysActive: number;
  daysOverdue: number;
  interestPerPeriod: number;
  totalDisbursed: number; // sum of disbursement rows — what's actually been handed over so far
  pendingDisbursement: number; // agreed principal not yet disbursed (0 for the common single-handover loan)
}

export interface LoanWithBalance extends Loan {
  balance: LoanBalance;
  status: LoanStoredStatus;
  derivedStatus: LoanStatus;
}

export interface CustomerSummary {
  totalBorrowed: number;
  principalPaid: number;
  interestPaid: number;
  totalPayments: number;
  principalOutstanding: number;
  interestOutstanding: number;
  totalOutstanding: number;
  activeLoans: number;
  completedLoans: number;
  overdueLoans: number;
  totalLoans: number;
  lastPaymentDate: string | null;
  // Earliest start date among this customer's non-cancelled loans — shown
  // on the customers table instead of the customer record's `createdAt`,
  // which (especially for historical data entered in bulk on one day)
  // doesn't reflect when money actually changed hands.
  firstLoanDate: string | null;
}

export interface DashboardStats {
  totalMoneyLent: number;
  principalOutstanding: number;
  interestEarned: number;
  interestPending: number;
  totalCollected: number;
  todaysCollection: number;
  upcomingDue: number;
  overdueAmount: number;
  activeLoans: number;
  overdueLoans: number;
  paidLoans: number;
  customers: number;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
