// Date helpers built on date-fns. `parseISO` (unlike `new Date(str)`) treats
// a date-only string like "2026-01-05" as LOCAL midnight, not UTC midnight —
// that distinction matters a lot for interest accrual math, which must never
// shift by a day depending on the server's time zone.
import {
  parseISO,
  format,
  startOfDay as fnsStartOfDay,
  addDays as fnsAddDays,
  addMonths as fnsAddMonths,
  differenceInCalendarDays,
  formatDistanceToNowStrict,
} from "date-fns";

export function parseDate(d: string | Date | null | undefined): Date {
  if (!d) return fnsStartOfDay(new Date());
  if (d instanceof Date) return d;
  return d.length === 10 ? parseISO(d) : new Date(d);
}

export function startOfDay(d: string | Date): Date {
  return fnsStartOfDay(parseDate(d));
}

export function toISODate(d: string | Date): string {
  return format(parseDate(d), "yyyy-MM-dd");
}

export function todayStr(): string {
  return toISODate(new Date());
}

export function addDays(d: string | Date, n: number): Date {
  return fnsAddDays(parseDate(d), n);
}

export function addMonths(d: string | Date, n: number): Date {
  return fnsAddMonths(parseDate(d), n);
}

export function daysBetween(a: string | Date, b: string | Date): number {
  return differenceInCalendarDays(startOfDay(b), startOfDay(a));
}

const DATE_FMT: Record<string, string> = {
  "DD/MM/YYYY": "dd/MM/yyyy",
  "MM/DD/YYYY": "MM/dd/yyyy",
  "YYYY-MM-DD": "yyyy-MM-dd",
  "DD MMM YYYY": "dd MMM yyyy",
};

export function formatDate(d: string | Date | null | undefined, pattern = "DD/MM/YYYY"): string {
  if (!d) return "—";
  return format(parseDate(d), DATE_FMT[pattern] ?? DATE_FMT["DD/MM/YYYY"]);
}

export function formatDateTime(d: string | Date | null | undefined, pattern = "DD/MM/YYYY"): string {
  if (!d) return "—";
  return `${formatDate(d, pattern)}, ${format(parseDate(d), "hh:mm a")}`;
}

export function timeAgo(d: string | Date): string {
  return `${formatDistanceToNowStrict(parseDate(d))} ago`;
}
