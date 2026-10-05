import { getAllCustomers, getAllLoansWithBalance, getAllPayments } from "@/lib/queries";
import { InterestTable } from "@/components/loans/InterestTable";
import { parseDate, todayStr } from "@/lib/dates";
import { round2 } from "@/lib/calculations";

export const metadata = { title: "Interest — LendPro" };
export const dynamic = "force-dynamic";

export default async function InterestPage() {
  const [loans, customers, payments] = await Promise.all([getAllLoansWithBalance(), getAllCustomers(), getAllPayments()]);
  const names = new Map(customers.map((c) => [c.id, c.name]));

  const today = todayStr();
  const monthPrefix = today.slice(0, 7);
  // Same exclusion as the page's other totals, which skip cancelled loans.
  const countedLoanIds = new Set(loans.filter((l) => l.derivedStatus !== "CANCELLED").map((l) => l.id));
  const collectedThisMonth = round2(
    payments.filter((p) => p.paymentDate.startsWith(monthPrefix) && countedLoanIds.has(p.loanId)).reduce((s, p) => s + p.interestAmount, 0)
  );
  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(parseDate(today));

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">Interest</h1>
        <p className="text-text-secondary text-[13.5px] mt-0.5">Interest accrued, collected and pending across the portfolio.</p>
      </div>
      <InterestTable loans={loans} customerNames={names} collectedThisMonth={collectedThisMonth} monthLabel={monthLabel} />
    </div>
  );
}
