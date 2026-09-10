import { getAllCustomers, getAllPayments } from "@/lib/queries";
import { PaymentsTable, ExportPaymentsButton } from "@/components/payments/PaymentsTable";
import { AddPaymentIconButton } from "@/components/payments/PaymentFormModal";
import { StatCard } from "@/components/ui/StatCard";
import { formatCurrency } from "@/lib/format";
import { Wallet, Percent, TrendingUp, Receipt } from "@/components/ui/icons";

export const metadata = { title: "Payments — LendPro" };
export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const [payments, customers] = await Promise.all([getAllPayments(), getAllCustomers()]);
  const names = new Map(customers.map((c) => [c.id, c.name]));
  const totals = payments.reduce(
    (a, p) => {
      a.amount += p.amount;
      a.interest += p.interestAmount;
      a.principal += p.principalAmount;
      return a;
    },
    { amount: 0, interest: 0, principal: 0 }
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Payments</h1>
          <p className="text-text-secondary text-[13.5px] mt-0.5">Every collection recorded, with its interest and principal split.</p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <ExportPaymentsButton payments={payments} customerNames={names} />
          <AddPaymentIconButton />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Payments" value={payments.length} icon={Receipt} tone="primary" />
        <StatCard label="Total Collected" value={formatCurrency(totals.amount)} icon={Wallet} tone="success" />
        <StatCard label="Interest Portion" value={formatCurrency(totals.interest)} icon={Percent} tone="purple" />
        <StatCard label="Principal Portion" value={formatCurrency(totals.principal)} icon={TrendingUp} tone="info" />
      </div>
      <PaymentsTable payments={payments} customerNames={names} />
    </div>
  );
}
