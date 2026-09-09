// Demo data seed — mirrors the original prototype's seedDemoData(): one
// admin, 20 customers, 30 loans, ~100 payments (generated with the real
// interest engine so every balance is internally consistent), 50
// activities and 15 notifications. Idempotent: skips entirely if any
// customers already exist. Run with `npx prisma db seed`.
import "dotenv/config";
import { PrismaClient, InterestFrequency, InterestType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { calculateLoanBalance, calculateInterestForLoan, computeAllocation } from "../src/lib/calculations";
import { addDays, addMonths, toISODate, todayStr } from "../src/lib/dates";
import { isoToDbDate } from "../src/lib/serialize";
import type { Loan, Payment } from "../src/lib/types";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const FIRST = ["Ravi", "Suresh", "Priya", "Anil", "Mahesh", "Lakshmi", "Kiran", "Ramesh", "Sunita", "Vijay", "Deepa", "Arjun", "Meena", "Rajesh", "Kavita", "Sanjay", "Pooja", "Manoj", "Anita", "Vikram", "Neha", "Ashok", "Geeta", "Ajay", "Rekha", "Naveen", "Divya", "Harish"];
const LAST = ["Kumar", "Reddy", "Sharma", "Singh", "Patel", "Gupta", "Nair", "Iyer", "Rao", "Verma", "Joshi", "Mehta", "Desai", "Pillai", "Chauhan", "Yadav", "Naidu"];
const CITIES: [string, string, string][] = [
  ["Mumbai", "Maharashtra", "400001"], ["Bengaluru", "Karnataka", "560001"], ["Chennai", "Tamil Nadu", "600001"],
  ["Hyderabad", "Telangana", "500001"], ["Pune", "Maharashtra", "411001"], ["New Delhi", "Delhi", "110001"],
  ["Ahmedabad", "Gujarat", "380001"], ["Kolkata", "West Bengal", "700001"], ["Jaipur", "Rajasthan", "302001"],
  ["Lucknow", "Uttar Pradesh", "226001"], ["Coimbatore", "Tamil Nadu", "641001"], ["Vijayawada", "Andhra Pradesh", "520001"],
];
const STREETS = ["MG Road", "Park Street", "Station Road", "Church Street", "Gandhi Nagar", "Nehru Colony", "Anna Salai", "Brigade Road", "Jubilee Hills", "Civil Lines"];

const counters: Record<string, number> = {};
async function genId(type: "customer" | "loan" | "payment"): Promise<string> {
  const prefix = { customer: "CUS", loan: "LN", payment: "PAY" }[type];
  const year = new Date().getFullYear();
  const key = `${type}_${year}`;
  counters[key] = (counters[key] ?? 0) + 1;
  await prisma.counter.upsert({ where: { key }, create: { key, value: counters[key] }, update: { value: counters[key] } });
  return `${prefix}-${year}-${String(counters[key]).padStart(4, "0")}`;
}

async function main() {
  const existingCustomers = await prisma.customer.count();
  if (existingCustomers > 0) {
    console.log(`Skipping seed — ${existingCustomers} customer(s) already exist.`);
    return ensureAdmin();
  }

  await ensureAdmin();
  const admin = await prisma.admin.findUniqueOrThrow({ where: { email: "admin@example.com" } });

  // ---- Customers ----
  const used = new Set<string>();
  const customers: { id: string; name: string; createdAt: Date }[] = [];
  for (let i = 0; i < 20; i++) {
    let name: string;
    do {
      name = `${pick(FIRST)} ${pick(LAST)}`;
    } while (used.has(name));
    used.add(name);
    const [city, state, pin] = pick(CITIES);
    const created = addDays(new Date(), -randInt(3, 330));
    const id = await genId("customer");
    await prisma.customer.create({
      data: {
        id,
        name,
        phone: `+91 ${randInt(70000, 99999)} ${randInt(10000, 99999)}`,
        email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        address: `${randInt(1, 250)}, ${pick(STREETS)}`,
        city,
        state,
        postalCode: pin,
        notes: pick(["", "", "Referred by existing customer.", "Prefers UPI payments.", "Shop owner — collect on Mondays.", "Long-term customer, reliable payer."]),
        status: Math.random() > 0.12 ? "ACTIVE" : "INACTIVE",
        createdAt: created,
        updatedAt: created,
      },
    });
    customers.push({ id, name, createdAt: created });
  }

  // ---- Loans ----
  const freqPool: InterestFrequency[] = ["MONTHLY", "MONTHLY", "MONTHLY", "MONTHLY", "WEEKLY", "DAILY", "YEARLY"];
  const loans: Loan[] = [];
  for (let i = 0; i < 30; i++) {
    const cust = pick(customers);
    const principal = pick([10, 15, 20, 25, 30, 40, 50, 60, 75, 80, 100, 120, 150, 200, 250, 300]) * 1000;
    const interestType: InterestType = Math.random() < 0.78 ? "PERCENTAGE" : "FIXED";
    const freq = pick(freqPool);
    let rate: number;
    if (interestType === "FIXED") {
      const pct = { DAILY: 0.001, WEEKLY: 0.005, MONTHLY: 0.02, YEARLY: 0.15 }[freq];
      rate = Math.max(100, Math.round((principal * pct) / 100) * 100);
    } else {
      rate = { DAILY: pick([0.5, 1, 1]), WEEKLY: pick([1, 1.5, 2]), MONTHLY: pick([1.5, 2, 2, 2.5, 3]), YEARLY: pick([12, 15, 18, 24]) }[freq];
    }
    const startDaysAgo = randInt(15, 300);
    const start = addDays(new Date(), -startDaysAgo);
    const termMonths = pick([3, 4, 6, 6, 9, 12]);
    let due = addMonths(start, termMonths);
    if (i % 9 === 0) due = addDays(new Date(), randInt(0, 1)); // due today/tomorrow
    if (i % 11 === 0) due = addDays(new Date(), randInt(2, 6)); // due this week
    const repaymentType = pick(["Interest Only", "Principal + Interest", "Principal First", "Custom"]);
    const id = await genId("loan");
    const loan: Loan = {
      id,
      customerId: cust.id,
      principal,
      interestRate: rate,
      interestType,
      interestFrequency: freq,
      startDate: toISODate(start),
      dueDate: toISODate(due),
      repaymentType,
      status: "ACTIVE",
      cancelledAt: null,
      collectionDay: null,
      notes: pick(["", "", "Business working capital.", "Personal loan against gold.", "Shop expansion.", "Vehicle purchase."]),
      createdAt: start.toISOString(),
      updatedAt: start.toISOString(),
    };
    await prisma.loan.create({
      data: {
        id,
        customerId: loan.customerId,
        principal: loan.principal,
        interestRate: loan.interestRate,
        interestType: loan.interestType,
        interestFrequency: loan.interestFrequency,
        startDate: isoToDbDate(loan.startDate),
        dueDate: isoToDbDate(loan.dueDate),
        repaymentType: loan.repaymentType,
        notes: loan.notes,
        createdAt: start,
        updatedAt: start,
      },
    });
    loans.push(loan);
  }

  // ---- Payments (generated with the real engine, ~100 total) ----
  const methods = ["Cash", "Cash", "UPI", "UPI", "Bank Transfer", "Cheque", "Other"];
  const allPayments: Payment[] = [];
  const paymentsByLoan = new Map<string, Payment[]>();
  const yesterday = addDays(new Date(), -1);
  const shuffled = [...loans].sort(() => Math.random() - 0.5);
  let count = 0;
  let round = 0;
  while (count < 100 && round < 40) {
    let added = 0;
    for (const loan of shuffled) {
      if (count >= 100) break;
      const existing = paymentsByLoan.get(loan.id) ?? [];
      const gap = round < 6 ? randInt(12, 35) : randInt(4, 12);
      const cursor = existing.length ? addDays(existing[existing.length - 1].paymentDate, gap) : addDays(loan.startDate, randInt(10, 30));
      if (cursor > yesterday) continue;
      const bal = calculateLoanBalance(loan, existing, cursor);
      if (bal.totalOutstanding <= 100) continue;
      const interestDue = Math.max(0, calculateInterestForLoan(loan, cursor, existing) - existing.reduce((s, p) => s + p.interestAmount, 0));
      let amount: number;
      const r = Math.random();
      if (r < 0.45) amount = Math.round(interestDue / 100) * 100;
      else if (r < 0.85) amount = Math.round((interestDue + Math.min(bal.principalRemaining, pick([2, 5, 10, 20]) * 1000)) / 100) * 100;
      else if (r < 0.93) amount = Math.round(bal.totalOutstanding);
      else amount = Math.round(Math.min(bal.totalOutstanding, pick([500, 1000, 2000])));
      if (amount < 100) amount = Math.round(Math.min(bal.totalOutstanding, pick([500, 1000, 2000])));
      let interestAmount = Math.min(amount, interestDue);
      let principalAmount = Math.min(amount - interestAmount, bal.principalRemaining);
      interestAmount = Math.round(interestAmount * 100) / 100;
      principalAmount = Math.round(principalAmount * 100) / 100;
      if (interestAmount + principalAmount < 100) continue;
      const id = await genId("payment");
      const payment: Payment = {
        id,
        loanId: loan.id,
        customerId: loan.customerId,
        amount: Math.round((interestAmount + principalAmount) * 100) / 100,
        interestAmount,
        principalAmount,
        paymentMethod: pick(methods),
        paymentDate: toISODate(cursor),
        reference: Math.random() < 0.5 ? `TXN${randInt(100000, 999999)}` : null,
        notes: null,
        recordedBy: admin.name,
        createdAt: cursor.toISOString(),
        updatedAt: cursor.toISOString(),
      };
      await prisma.payment.create({
        data: {
          id,
          loanId: payment.loanId,
          customerId: payment.customerId,
          amount: payment.amount,
          interestAmount: payment.interestAmount,
          principalAmount: payment.principalAmount,
          paymentMethod: payment.paymentMethod,
          paymentDate: isoToDbDate(payment.paymentDate),
          reference: payment.reference,
          recordedBy: payment.recordedBy,
          createdAt: cursor,
          updatedAt: cursor,
        },
      });
      allPayments.push(payment);
      existing.push(payment);
      paymentsByLoan.set(loan.id, existing);
      count++;
      added++;
    }
    if (!added) break;
    round++;
  }

  // A few payments dated today so "Today's Collection" is non-zero on first launch.
  const todayCandidates = loans.filter((l) => calculateLoanBalance(l, paymentsByLoan.get(l.id) ?? []).totalOutstanding > 500).slice(0, 3);
  for (const loan of todayCandidates) {
    const existing = paymentsByLoan.get(loan.id) ?? [];
    const bal = calculateLoanBalance(loan, existing);
    const amt = Math.min(bal.totalOutstanding, pick([2000, 5000, 10000, 15000]));
    const a = computeAllocation(loan, existing, amt, "interest_principal");
    const id = await genId("payment");
    const now = new Date();
    await prisma.payment.create({
      data: {
        id,
        loanId: loan.id,
        customerId: loan.customerId,
        amount: Math.round((a.interestAmount + a.principalAmount) * 100) / 100,
        interestAmount: a.interestAmount,
        principalAmount: a.principalAmount,
        paymentMethod: pick(["Cash", "UPI"]),
        paymentDate: isoToDbDate(todayStr()),
        recordedBy: admin.name,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  // One cancelled loan, for status coverage.
  const cancelCandidate = pick(loans.filter((l) => (paymentsByLoan.get(l.id) ?? []).length === 0));
  if (cancelCandidate) {
    await prisma.loan.update({
      where: { id: cancelCandidate.id },
      data: { status: "CANCELLED", cancelledAt: isoToDbDate(toISODate(addDays(cancelCandidate.startDate, 2))), notes: "Cancelled — customer withdrew the request." },
    });
  }

  // ---- Activities: customer_created (20) + loan_created (30) = 50 ----
  for (const c of customers) {
    await prisma.activity.create({ data: { type: "customer_created", description: `New customer ${c.name} added`, customerId: c.id, createdAt: c.createdAt } });
  }
  const nameOf = new Map(customers.map((c) => [c.id, c.name]));
  for (const l of loans) {
    await prisma.activity.create({
      data: {
        type: "loan_created",
        description: `New loan of ₹${l.principal.toLocaleString("en-IN")} created for ${nameOf.get(l.customerId)}`,
        customerId: l.customerId,
        loanId: l.id,
        createdAt: new Date(l.createdAt),
      },
    });
  }

  // ---- Notifications (15) ----
  const notifTpl: [string, () => string][] = [
    ["payment", () => { const p = pick(allPayments.length ? allPayments : [{ amount: 2000, customerId: customers[0].id } as Payment]); return `Payment of ₹${p.amount.toLocaleString("en-IN")} received from ${nameOf.get(p.customerId)}`; }],
    ["due", () => `Payment due today for ${pick(customers).name}`],
    ["overdue", () => { const l = pick(loans); return `Loan ${l.id} for ${nameOf.get(l.customerId)} is overdue`; }],
    ["customer", () => `New customer added: ${pick(customers).name}`],
    ["loan", () => { const l = pick(loans); return `New loan ${l.id} of ₹${l.principal.toLocaleString("en-IN")} created for ${nameOf.get(l.customerId)}`; }],
    ["paid", () => `Loan ${pick(loans).id} fully paid`],
  ];
  for (let i = 0; i < 15; i++) {
    const [type, fn] = notifTpl[i % notifTpl.length];
    await prisma.notification.create({
      data: { type, message: fn(), read: i > 5, createdAt: addDays(new Date(), -randInt(0, 12)) },
    });
  }

  // ---- Settings ----
  await prisma.settings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      businessName: "LendPro Financial Services",
      businessPhone: "+91 98765 43210",
      businessEmail: "contact@lendpro.example",
      businessAddress: "221, Business Bay, Andheri East, Mumbai, Maharashtra 400069",
      defaultInterestRate: 2,
      defaultInterestType: "PERCENTAGE",
      defaultFrequency: "MONTHLY",
      defaultRepaymentType: "Interest Only",
      defaultPaymentMethod: "Cash",
    },
    update: {},
  });

  console.log(`Seeded: ${customers.length} customers, ${loans.length} loans, ${allPayments.length + todayCandidates.length} payments.`);
}

async function ensureAdmin() {
  const passwordHash = await bcrypt.hash("admin123", 12);
  await prisma.admin.upsert({
    where: { email: "admin@example.com" },
    create: { name: "Admin User", email: "admin@example.com", passwordHash, phone: "+91 98765 43210", role: "Administrator" },
    update: {},
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
