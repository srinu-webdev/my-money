import { businessNow, parseDate } from "./dates";

export interface MonthBucket {
  y: number;
  m: number;
  label: string;
}

export function getLastNMonths(n: number): MonthBucket[] {
  const out: MonthBucket[] = [];
  const now = businessNow();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString("en-IN", { month: "short" }) + (d.getFullYear() !== now.getFullYear() ? ` '${String(d.getFullYear()).slice(2)}` : "");
    out.push({ y: d.getFullYear(), m: d.getMonth(), label });
  }
  return out;
}

export function monthlyAggregate<T>(records: T[], dateField: (r: T) => string, valueFn: (r: T) => number, months: MonthBucket[]): number[] {
  return months.map((mo) =>
    records.reduce((sum, r) => {
      const d = parseDate(dateField(r));
      return d.getFullYear() === mo.y && d.getMonth() === mo.m ? sum + (Number(valueFn(r)) || 0) : sum;
    }, 0)
  );
}
