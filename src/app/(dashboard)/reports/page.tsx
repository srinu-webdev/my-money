import { getAllCustomers, getAllLoans, getAllPayments } from "@/lib/queries";
import { ReportsView } from "@/components/reports/ReportsView";

export const metadata = { title: "Reports — LendPro" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [loans, payments, customers] = await Promise.all([getAllLoans(), getAllPayments(), getAllCustomers()]);
  return <ReportsView loans={loans} payments={payments} customers={customers} />;
}
