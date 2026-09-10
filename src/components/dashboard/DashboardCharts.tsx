"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { GroupedMoneyBarChart, MoneyLineChart, LoanStatusDoughnut, CountBarChart } from "@/components/charts/Charts";

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
      <Card>
        <CardHeader title="Money Lent & Interest Collected" sub="Principal disbursed vs. interest collected, per month" />
        <div className="p-4 h-[280px]">
          <GroupedMoneyBarChart
            labels={months8Labels}
            series={[
              { label: "Money Lent", data: moneyLent, color: "primary" },
              { label: "Interest Collected", data: interestCollected, color: "purple" },
            ]}
          />
        </div>
      </Card>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-5">
        <Card>
          <CardHeader title="Payment Collections" sub="Total collected per month" />
          <div className="p-4 h-[240px]">
            <MoneyLineChart labels={months8Labels} data={collections} color="success" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Loan Status" sub="Portfolio breakdown" />
          <div className="p-4 h-[240px]">
            <LoanStatusDoughnut labels={statusLabels} data={statusData} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Customer Growth" sub="New registrations per month" />
          <div className="p-4 h-[240px]">
            <CountBarChart labels={months6Labels} data={customerGrowth} color="info" />
          </div>
        </Card>
      </div>
    </div>
  );
}
