"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { MoneyBarChart, MoneyLineChart, LoanStatusDoughnut, CountBarChart } from "@/components/charts/Charts";

export function DashboardCharts({
  months8Labels,
  moneyLent,
  collections,
  interestCollected,
  statusLabels,
  statusData,
  months6Labels,
  customerGrowth,
}: {
  months8Labels: string[];
  moneyLent: number[];
  collections: number[];
  interestCollected: number[];
  statusLabels: string[];
  statusData: number[];
  months6Labels: string[];
  customerGrowth: number[];
}) {
  return (
    <div>
      <div className="grid md:grid-cols-2 gap-5">
        <Card>
          <CardHeader title="Money Lent" sub="Principal disbursed per month" />
          <div className="p-4 h-[260px]">
            <MoneyBarChart labels={months8Labels} data={moneyLent} color="primary" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Payment Collections" sub="Total collected per month" />
          <div className="p-4 h-[260px]">
            <MoneyLineChart labels={months8Labels} data={collections} color="success" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Interest Collected" sub="Interest portion of collections" />
          <div className="p-4 h-[260px]">
            <MoneyBarChart labels={months8Labels} data={interestCollected} color="purple" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Loan Status" sub="Portfolio breakdown" />
          <div className="p-4 h-[260px]">
            <LoanStatusDoughnut labels={statusLabels} data={statusData} />
          </div>
        </Card>
      </div>
      <Card className="mt-5">
        <CardHeader title="Customer Growth" sub="New registrations per month" />
        <div className="p-4 h-[220px]">
          <CountBarChart labels={months6Labels} data={customerGrowth} color="info" />
        </div>
      </Card>
    </div>
  );
}
