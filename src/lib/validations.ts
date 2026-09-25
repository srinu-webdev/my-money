import { z } from "zod";
import { todayStr } from "@/lib/dates";

// Shape-level validation with zod. Business-rule validation that needs a
// database lookup (e.g. "payment can't exceed the outstanding balance",
// "customer can't be deleted while they have active loans") happens in
// the server action itself, right before the write — see lib/actions/*.

const phoneRe = /^[+\d][\d\s\-()]{6,}$/;
// At least one letter and one digit — not a strong complexity policy, but
// enough to rule out a bare 8-digit number or "aaaaaaaa", the two most
// common weak passwords a length-only rule lets through.
const passwordComplexity = /^(?=.*[A-Za-z])(?=.*\d).+$/;

// Shared with settingsSchema below so a saved "default repayment type" /
// "default payment method" can never drift from the actual options the
// New Loan / New Payment forms offer (an unconstrained free-text default
// that matches none of them used to silently break the forms' pre-fill).
const REPAYMENT_TYPES = ["Interest Only", "Daily Installment", "Principal + Interest", "Custom"] as const;
const PAYMENT_METHODS = ["Cash", "UPI", "Bank Transfer", "Cheque", "Other"] as const;

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Full name is required.").max(120, "Name is too long."),
  phone: z.string().trim().regex(phoneRe, "Please enter a valid phone number.").max(30, "Phone number is too long."),
  email: z.union([z.literal(""), z.string().trim().email("Please enter a valid email address.").max(254)]).optional(),
  address: z.string().trim().max(300, "Address is too long.").optional(),
  city: z.string().trim().max(100, "City is too long.").optional(),
  state: z.string().trim().max(100, "State is too long.").optional(),
  postalCode: z.string().trim().max(20, "Postal code is too long.").optional(),
  notes: z.string().trim().max(2000, "Notes are too long.").optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const loanSchema = z
  .object({
    customerId: z.string().min(1, "Please select a customer."),
    principal: z.coerce.number().positive("Loan amount must be greater than zero.").max(1e9, "Loan amount is unrealistically large."),
    interestRate: z.coerce.number().min(0, "Interest rate cannot be negative."),
    interestType: z.enum(["PERCENTAGE", "FIXED"]),
    interestFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
    startDate: z.string().min(1, "Please enter a valid start date."),
    dueDate: z.string().min(1, "Please enter a valid due date."),
    repaymentType: z.enum(REPAYMENT_TYPES),
    // Optional: how much is actually being handed over today. Left blank
    // (or equal to principal) means "the full amount, right now" — the
    // common case, unchanged from before this field existed. Set lower
    // than principal for a loan given out in tranches (₹50,000 now of a
    // ₹1,00,000 agreement); the rest can be added later via "Add Disbursement".
    initialDisbursement: z.coerce.number().min(0).optional(),
    // Overrides the recurring monthly collection day (1-31). Blank means
    // "use the start date's own day-of-month" — the common case. Set
    // this when the real collection day differs from when the loan
    // happened to be disbursed (e.g. always the 15th of every month).
    collectionDay: z.coerce.number().int().min(1).max(31).optional(),
    notes: z.string().trim().max(2000, "Notes are too long.").optional(),
  })
  .refine((d) => d.dueDate > d.startDate, { message: "Due date must be after the start date.", path: ["dueDate"] })
  // createLoanAction creates the initial Disbursement row dated exactly
  // `startDate` — and calculateLoanBalance's totalDisbursed/pendingDisbursement
  // sum every Disbursement row unconditionally (no date filtering, since a
  // row existing is assumed to mean the money was ALREADY handed over). A
  // future startDate would make that row count as disbursed today while the
  // interest engine correctly won't accrue on it yet — the same
  // inconsistency a future-dated disbursement tranche would cause.
  .refine((d) => d.startDate <= todayStr(), { message: "Start date cannot be in the future.", path: ["startDate"] })
  .refine((d) => !(d.interestType === "PERCENTAGE" && d.interestRate > 100), {
    message: "Percentage rate cannot exceed 100% per period.",
    path: ["interestRate"],
  })
  .refine((d) => d.initialDisbursement === undefined || d.initialDisbursement <= d.principal, {
    message: "The initial disbursement can't exceed the loan amount.",
    path: ["initialDisbursement"],
  });

export const disbursementSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  date: z.string().min(1, "Please enter a valid date."),
  notes: z.string().trim().max(2000, "Notes are too long.").optional(),
});
export type DisbursementInput = z.infer<typeof disbursementSchema>;
export type LoanInput = z.infer<typeof loanSchema>;

export const paymentSchema = z.object({
  loanId: z.string().min(1, "Please select a valid loan."),
  amount: z.coerce.number().positive("Payment amount must be greater than zero."),
  paymentDate: z.string().min(1, "Please enter a valid payment date."),
  paymentMethod: z.enum(PAYMENT_METHODS),
  allocation: z.enum(["interest", "principal", "interest_principal", "custom"]),
  customInterest: z.coerce.number().min(0).optional(),
  customPrincipal: z.coerce.number().min(0).optional(),
  reference: z.string().trim().max(200, "Reference is too long.").optional(),
  notes: z.string().trim().max(2000, "Notes are too long.").optional(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const settingsSchema = z.object({
  businessName: z.string().trim().min(1).max(200, "Business name is too long."),
  businessPhone: z.string().trim().max(30, "Phone number is too long.").optional(),
  businessEmail: z.union([z.literal(""), z.string().trim().email().max(254)]).optional(),
  businessAddress: z.string().trim().max(300, "Address is too long.").optional(),
  dateFormat: z.string(),
  defaultInterestRate: z.coerce.number().min(0),
  defaultInterestType: z.enum(["PERCENTAGE", "FIXED"]),
  defaultFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  defaultRepaymentType: z.enum(REPAYMENT_TYPES),
  defaultPaymentMethod: z.enum(PAYMENT_METHODS),
  dueReminder: z.coerce.boolean().default(false),
  overdueReminder: z.coerce.boolean().default(false),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120, "Name is too long."),
  email: z.string().trim().email("Please enter a valid email.").max(254),
  phone: z.string().trim().max(30, "Phone number is too long.").optional(),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const passwordSchema = z
  .object({
    current: z.string().min(1, "Current password is required.").max(128),
    next: z
      .string()
      .min(8, "New password must be at least 8 characters.")
      .max(128, "New password is too long.")
      .regex(passwordComplexity, "New password must include at least one letter and one number."),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { message: "New passwords do not match.", path: ["confirm"] });
export type PasswordInput = z.infer<typeof passwordSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email.").max(254),
  password: z.string().min(1, "Password is required.").max(128),
  remember: z.coerce.boolean().default(false),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Full name is required.").max(120, "Name is too long."),
    email: z.string().trim().email("Please enter a valid email address.").max(254),
    phone: z.string().trim().max(30, "Phone number is too long.").optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(128, "Password is too long.")
      .regex(passwordComplexity, "Password must include at least one letter and one number."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match.", path: ["confirm"] });
export type SignupInput = z.infer<typeof signupSchema>;

export const reminderSchema = z.object({
  loanId: z.string().min(1),
  type: z.enum(["due", "overdue", "general"]),
  channel: z.enum(["SMS", "WhatsApp", "Email"]),
  message: z.string().trim().min(1, "Please enter a message.").max(2000, "Message is too long."),
});
export type ReminderInput = z.infer<typeof reminderSchema>;
