"use client";

import { useRouter, usePathname } from "next/navigation";
import { Select } from "@/components/ui/Field";
import type { ReportRangeKey } from "@/lib/reports";

const OPTIONS: { key: ReportRangeKey; label: string }[] = [
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "this-month", label: "This Month" },
  { key: "last-month", label: "Last Month" },
  { key: "this-year", label: "This Year" },
  { key: "all", label: "All Time" },
];

// Drives the dashboard's date-scoped numbers via a real URL param (server
// re-renders with fresh data on change) rather than a client-only filter
// over data that was never actually scoped to the period.
export function DateRangeSelect({ value }: { value: ReportRangeKey }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Select
      value={value}
      onChange={(e) => router.push(`${pathname}?range=${e.target.value}`, { scroll: false })}
      className="min-w-[150px] max-w-[190px] text-[13px] font-semibold"
      aria-label="Date range"
    >
      {OPTIONS.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
