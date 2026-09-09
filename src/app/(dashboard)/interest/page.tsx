import { getAllCustomers, getAllLoansWithBalance } from "@/lib/queries";
import { InterestTable } from "@/components/loans/InterestTable";

export const metadata = { title: "Interest — LendPro" };
export const dynamic = "force-dynamic";

export default async function InterestPage() {
  const [loans, customers] = await Promise.all([getAllLoansWithBalance(), getAllCustomers()]);
  const names = new Map(customers.map((c) => [c.id, c.name]));
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">Interest</h1>
        <p className="text-text-secondary text-[13.5px] mt-0.5">Interest accrued, collected and pending across the portfolio.</p>
      </div>
      <InterestTable loans={loans} customerNames={names} />
    </div>
  );
}
