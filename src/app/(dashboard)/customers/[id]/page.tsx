import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Mail, MapPin, Phone } from "lucide-react";
import { getActivitiesFor, getCustomerWithSummary, getDisbursementsByLoan, getLoansByCustomer, getPaymentsByCustomer } from "@/lib/queries";
import { calculateLoanBalance, getLoanStatus } from "@/lib/calculations";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { MiniStat } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/dates";
import { EditCustomerButton } from "@/components/customers/CustomerFormModal";
import { AddLoanButton } from "@/components/loans/LoanFormModal";
import { RecordPaymentButton } from "@/components/payments/PaymentFormModal";
import { CustomerDetailTabs } from "@/components/customers/CustomerDetailTabs";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `${id} — LendPro` };
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomerWithSummary(id);
  if (!customer) notFound();

  const [loans, payments, activities] = await Promise.all([getLoansByCustomer(id), getPaymentsByCustomer(id), getActivitiesFor({ customerId: id }, 40)]);
  const disbursementsByLoan = new Map(await Promise.all(loans.map(async (l) => [l.id, await getDisbursementsByLoan(l.id)] as const)));
  const loanRows = loans.map((loan) => {
    const balance = calculateLoanBalance(loan, payments.filter((p) => p.loanId === loan.id), undefined, disbursementsByLoan.get(loan.id));
    return { ...loan, balance, derivedStatus: getLoanStatus(loan, balance) };
  });
  const s = customer.summary;

  return (
    <div>
      <div className="text-[12.5px] text-text-tertiary mb-2 flex items-center gap-1.5">
        <Link href="/customers" className="text-primary font-medium hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Customers
        </Link>
        <span>›</span>
        <span>{customer.id}</span>
      </div>

      <Card className="mb-5">
        <div className="p-4 sm:p-[22px]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 flex-wrap">
            <Avatar name={customer.name} size="xl" />
            <div className="flex-1 min-w-[220px]">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-[22px] font-extrabold tracking-tight">{customer.name}</h2>
                <Badge tone={customer.status === "ACTIVE" ? "success" : "gray"}>{customer.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>
                {s.overdueLoans ? <Badge tone="danger">Overdue</Badge> : null}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-text-secondary text-[13px] mt-1.5">
                <span className="font-mono">{customer.id}</span>
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-text-tertiary" /> {customer.phone}
                </span>
                {customer.email ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-text-tertiary" /> {customer.email}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-text-tertiary" /> Registered {formatDate(customer.createdAt)}
                </span>
                {customer.city ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-text-tertiary" /> {[customer.city, customer.state].filter(Boolean).join(", ")}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <EditCustomerButton customer={customer} />
              <AddLoanButton customerId={customer.id} label="Add Loan" />
              <RecordPaymentButton customerId={customer.id} />
            </div>
          </div>
          <div className="h-px bg-border my-5" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <MiniStat label="Total Borrowed" value={`₹${s.totalBorrowed.toLocaleString("en-IN")}`} />
            <MiniStat label="Principal Paid" value={`₹${s.principalPaid.toLocaleString("en-IN")}`} className="text-success-dark" />
            <MiniStat label="Interest Paid" value={`₹${s.interestPaid.toLocaleString("en-IN")}`} className="text-success-dark" />
            <MiniStat label="Total Collected" value={`₹${s.totalPayments.toLocaleString("en-IN")}`} className="text-success-dark" />
            <MiniStat label="Principal Outstanding" value={`₹${s.principalOutstanding.toLocaleString("en-IN")}`} className={s.principalOutstanding ? "text-warning-dark" : ""} />
            <MiniStat label="Interest Outstanding" value={`₹${s.interestOutstanding.toLocaleString("en-IN")}`} className={s.interestOutstanding ? "text-warning-dark" : ""} />
            <MiniStat label="Total Outstanding" value={`₹${s.totalOutstanding.toLocaleString("en-IN")}`} className={s.totalOutstanding ? "text-danger" : "text-success-dark"} />
            <MiniStat label="Active Loans" value={s.activeLoans} />
            <MiniStat label="Completed Loans" value={s.completedLoans} />
            <MiniStat label="Overdue Loans" value={s.overdueLoans} className={s.overdueLoans ? "text-danger" : ""} />
          </div>
        </div>
      </Card>

      <CustomerDetailTabs customer={customer} loans={loanRows} payments={payments} activities={activities} />
    </div>
  );
}
