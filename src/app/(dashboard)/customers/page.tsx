import { getAllCustomersWithSummary } from "@/lib/queries";
import { CustomersTable, ExportCustomersButton } from "@/components/customers/CustomersTable";
import { AddCustomerButton } from "@/components/customers/CustomerFormModal";

export const metadata = { title: "Customers — LendPro" };
export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await getAllCustomersWithSummary();
  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Customers</h1>
          <p className="text-text-secondary text-[13.5px] mt-0.5">Manage all borrowers and their financial records.</p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <ExportCustomersButton customers={customers} />
          <AddCustomerButton />
        </div>
      </div>
      <CustomersTable customers={customers} />
    </div>
  );
}
