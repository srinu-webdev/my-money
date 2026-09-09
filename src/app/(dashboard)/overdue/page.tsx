import { getAllCustomers, getAllLoansWithBalance } from "@/lib/queries";
import { OverdueTable } from "@/components/loans/OverdueTable";

export const metadata = { title: "Overdue — LendPro" };
export const dynamic = "force-dynamic";

export default async function OverduePage() {
  const [loans, customersList] = await Promise.all([getAllLoansWithBalance(), getAllCustomers()]);
  const customers = new Map(customersList.map((c) => [c.id, c]));
  return <OverdueTable loans={loans} customers={customers} />;
}
