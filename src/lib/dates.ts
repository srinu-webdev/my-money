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

// The business runs in India. Vercel's serverless clock is UTC, which is
// 5h30 BEHIND IST — so a naive `new Date()` on the server still says
// "yesterday" until 05:30 IST every morning, silently shifting every
// "today"-based figure (Due Today, Overdue, days active, the reminder
// cron's day count) and even rejecting a payment dated today as "in the
// future". Every "today" in the app — server AND client — must go
// through businessNow()/businessToday() so there is exactly one
// definition of the calendar day, wherever the code happens to run.
export const BUSINESS_TZ = "Asia/Kolkata";

/** The current calendar date in the business timezone, as a LOCAL-midnight Date (so it composes with the other helpers here). */
export function businessNow(): Date {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return parseISO(iso);
}

/** The current calendar date in the business timezone as "YYYY-MM-DD". */
export function businessToday(): string {
  return format(businessNow(), "yyyy-MM-dd");
}

export function parseDate(d: string | Date | null | undefined): Date {
  if (!d) return businessNow();
  if (d instanceof Date) return d;
  return d.length === 10 ? parseISO(d) : new Date(d);
}

export function startOfDay(d: string | Date): Date {
  return fnsStartOfDay(parseDate(d));
}

export function toISODate(d: string | Date): string {
  return format(parseDate(d), "yyyy-MM-dd");
}

/** Today in the business timezone — NOT the machine's clock. */
export function todayStr(): string {
  return businessToday();
}

/** The current hour (0-23) in the business timezone — for "good morning/afternoon/evening" style greetings, where the machine's own UTC clock would be wrong for most of an IST day. */
export function businessHour(): number {
  // hour12:false can format midnight as "24" in some runtimes — normalize.
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TZ, hour: "numeric", hour12: false }).format(new Date())) % 24;
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
