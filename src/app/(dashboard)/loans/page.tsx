import { getAllCustomers, getAllLoansWithBalance } from "@/lib/queries";
import { LoansTable, ExportLoansButton } from "@/components/loans/LoansTable";
import { AddLoanButton } from "@/components/loans/LoanFormModal";
import { StatCard } from "@/components/ui/StatCard";
import { formatCurrency } from "@/lib/format";
import { CreditCard, Wallet, Percent, AlertTriangle } from "@/components/ui/icons";

export const metadata = { title: "Loans — LendPro" };
export const dynamic = "force-dynamic";

export default async function LoansPage() {
  const [loans, customers] = await Promise.all([getAllLoansWithBalance(), getAllCustomers()]);
  const names = new Map(customers.map((c) => [c.id, c.name]));
  // Cancelled loans carry no real money; "lent" is cash actually handed over
  // (disbursed), across every loan ever given — completed ones included.
  const totals = loans
    .filter((l) => l.derivedStatus !== "CANCELLED")
    .reduce(
      (a, l) => {
        a.lent += l.balance.totalDisbursed;
        a.outstanding += l.balance.totalOutstanding;
        a.interestPending += l.balance.interestRemaining;
        if (l.derivedStatus !== "PAID") a.openLoans++;
        return a;
      },
      { lent: 0, outstanding: 0, interestPending: 0, openLoans: 0 }
    );

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Loans</h1>
          <p className="text-text-secondary text-[13.5px] mt-0.5">Every loan disbursed, with live interest and outstanding balances.</p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <ExportLoansButton loans={loans} customerNames={names} />
          <AddLoanButton />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Total Loans" value={loans.length} icon={CreditCard} tone="primary" hint={`${totals.openLoans} open`} />
        <StatCard label="Total Principal Lent" value={formatCurrency(totals.lent)} icon={Wallet} tone="purple" hint="All time, incl. completed loans" />
        <StatCard label="Interest Pending" value={formatCurrency(totals.interestPending)} icon={Percent} tone="warning" />
        <StatCard label="Total Outstanding" value={formatCurrency(totals.outstanding)} icon={AlertTriangle} tone="danger" hint="Principal + interest still owed" />
      </div>
      <LoansTable loans={loans} customerNames={names} />
    </div>
  );
}
