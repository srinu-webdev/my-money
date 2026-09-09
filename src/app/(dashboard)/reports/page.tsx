import { getAllCustomers, getAllDisbursements, getAllLoans, getAllPayments } from "@/lib/queries";
import { ReportsView } from "@/components/reports/ReportsView";

export const metadata = { title: "Reports — LendPro" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [loans, payments, customers, disbursements] = await Promise.all([getAllLoans(), getAllPayments(), getAllCustomers(), getAllDisbursements()]);
  return <ReportsView loans={loans} payments={payments} customers={customers} disbursements={disbursements} />;
}
