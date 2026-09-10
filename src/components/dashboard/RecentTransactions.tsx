import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Table, TableWrap, Th, Td } from "@/components/ui/Table";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import type { LoanStatus } from "@/lib/types";

export interface TransactionRow {
  id: string;
  date: string;
  customerId: string;
  customerName: string;
  loanId: string;
  type: "Loan Disbursal" | "Payment Received";
  amount: number;
  loanStatus: LoanStatus;
  reference: string;
}

export function RecentTransactions({ transactions }: { transactions: TransactionRow[] }) {
  return (
    <Card>
      <CardHeader title="Recent Transactions" sub="Latest disbursements and payments across the portfolio" actions={<Link href="/payments" className="text-primary text-sm font-semibold hover:underline shrink-0">View all →</Link>} />
      {transactions.length ? (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Customer</Th>
                <Th className="hidden sm:table-cell">Type</Th>
                <Th className="text-right">Amount</Th>
                <Th>Status</Th>
                <Th className="hidden lg:table-cell">Reference No.</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-surface-2">
                  <Td className="text-text-secondary">{formatDate(t.date)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar name={t.customerName} size="sm" />
                      <Link href={`/customers/${t.customerId}`} className="font-semibold text-primary hover:underline">
                        {t.customerName}
                      </Link>
                    </div>
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <Badge tone={t.type === "Loan Disbursal" ? "primary" : "success"}>{t.type}</Badge>
                  </Td>
                  <Td className={`text-right mono-nums font-semibold ${t.type === "Loan Disbursal" ? "" : "text-success-dark"}`}>
                    {t.type === "Loan Disbursal" ? "" : "+"}
                    {formatCurrency(t.amount)}
                  </Td>
                  <Td>
                    <StatusBadge status={t.loanStatus} />
                  </Td>
                  <Td className="hidden lg:table-cell font-mono text-text-tertiary text-[12px]">{t.reference || "—"}</Td>
                  <Td>
                    <Link href={`/loans/${t.loanId}`} className="text-primary font-mono text-[12.5px] hover:underline">
                      {t.loanId}
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      ) : (
        <div className="p-8 text-center text-text-tertiary text-sm">No transactions yet.</div>
      )}
    </Card>
  );
}
