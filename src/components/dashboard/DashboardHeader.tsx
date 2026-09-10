"use client";

import { Download } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { DateRangeSelect } from "@/components/dashboard/DateRangeSelect";
import { exportCSV } from "@/lib/csv";
import { businessNow, formatDate, toISODate } from "@/lib/dates";
import type { ReportRangeKey } from "@/lib/reports";

export function DashboardHeader({
  greeting,
  rangeKey,
  rangeLabel,
  exportRows,
}: {
  greeting: string;
  rangeKey: ReportRangeKey;
  rangeLabel: string;
  exportRows: (string | number)[][];
}) {
  function handleExport() {
    exportCSV(`lendpro-dashboard-${toISODate(businessNow())}.csv`, ["Metric", "Value"], exportRows);
  }

  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{greeting}</h1>
        <p className="text-text-secondary text-[13.5px] mt-0.5">
          Here&rsquo;s what&rsquo;s happening with your loans and collections — <strong>{rangeLabel}</strong> as of {formatDate(businessNow())}.
        </p>
      </div>
      <div className="flex items-center gap-2.5 flex-wrap">
        <DateRangeSelect value={rangeKey} />
        <Button variant="secondary" onClick={handleExport} title="Export dashboard summary as CSV">
          <Download /> <span className="hidden sm:inline">Export</span>
        </Button>
        <RefreshButton />
        <QuickActions showTopButtons />
      </div>
    </div>
  );
}
