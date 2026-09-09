import { z } from "zod";

// Shape-level validation with zod. Business-rule validation that needs a
// database lookup (e.g. "payment can't exceed the outstanding balance",
// "customer can't be deleted while they have active loans") happens in
// the server action itself, right before the write — see lib/actions/*.

const phoneRe = /^[+\d][\d\s\-()]{6,}$/;

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Full name is required."),
  phone: z.string().trim().regex(phoneRe, "Please enter a valid phone number."),
  email: z.union([z.literal(""), z.string().trim().email("Please enter a valid email address.")]).optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  notes: z.string().trim().optional(),
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
    repaymentType: z.enum(["Interest Only", "Principal + Interest", "Principal First", "Daily Installment", "Custom"]),
    notes: z.string().trim().optional(),
  })
  .refine((d) => d.dueDate > d.startDate, { message: "Due date must be after the start date.", path: ["dueDate"] })
  .refine((d) => !(d.interestType === "PERCENTAGE" && d.interestRate > 100), {
    message: "Percentage rate cannot exceed 100% per period.",
    path: ["interestRate"],
  });
export type LoanInput = z.infer<typeof loanSchema>;

export const paymentSchema = z.object({
  loanId: z.string().min(1, "Please select a valid loan."),
  amount: z.coerce.number().positive("Payment amount must be greater than zero."),
  paymentDate: z.string().min(1, "Please enter a valid payment date."),
  paymentMethod: z.enum(["Cash", "UPI", "Bank Transfer", "Cheque", "Other"]),
  allocation: z.enum(["interest", "principal", "interest_principal", "custom"]),
  customInterest: z.coerce.number().min(0).optional(),
  customPrincipal: z.coerce.number().min(0).optional(),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const settingsSchema = z.object({
  businessName: z.string().trim().min(1),
  businessPhone: z.string().trim().optional(),
  businessEmail: z.union([z.literal(""), z.string().trim().email()]).optional(),
  businessAddress: z.string().trim().optional(),
  dateFormat: z.string(),
  defaultInterestRate: z.coerce.number().min(0),
  defaultInterestType: z.enum(["PERCENTAGE", "FIXED"]),
  defaultFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  defaultRepaymentType: z.string(),
  defaultPaymentMethod: z.string(),
  dueReminder: z.coerce.boolean().default(false),
  overdueReminder: z.coerce.boolean().default(false),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("Please enter a valid email."),
  phone: z.string().trim().optional(),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const passwordSchema = z
  .object({
    current: z.string().min(1, "Current password is required."),
    next: z.string().min(6, "New password must be at least 6 characters."),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { message: "New passwords do not match.", path: ["confirm"] });
export type PasswordInput = z.infer<typeof passwordSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email."),
  password: z.string().min(1, "Password is required."),
  remember: z.coerce.boolean().default(false),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Full name is required."),
    email: z.string().trim().email("Please enter a valid email address."),
    phone: z.string().trim().optional(),
    password: z.string().min(6, "Password must be at least 6 characters."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match.", path: ["confirm"] });
export type SignupInput = z.infer<typeof signupSchema>;

export const reminderSchema = z.object({
  loanId: z.string().min(1),
  type: z.enum(["due", "overdue", "general"]),
  channel: z.enum(["SMS", "WhatsApp", "Email"]),
  message: z.string().trim().min(1, "Please enter a message."),
});
export type ReminderInput = z.infer<typeof reminderSchema>;
