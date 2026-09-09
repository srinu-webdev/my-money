import { Wallet, CalendarDays, AlertTriangle, Users, CreditCard, CheckCircle2, Send, Info, type LucideIcon } from "lucide-react";

const MAP: Record<string, { Icon: LucideIcon; cls: string }> = {
  payment: { Icon: Wallet, cls: "bg-success-light text-success-dark dark:text-emerald-400" },
  due: { Icon: CalendarDays, cls: "bg-warning-light text-warning-dark dark:text-amber-400" },
  overdue: { Icon: AlertTriangle, cls: "bg-danger-light text-danger dark:text-red-400" },
  customer: { Icon: Users, cls: "bg-primary-50 text-primary-600 dark:text-indigo-300" },
  loan: { Icon: CreditCard, cls: "bg-purple/10 text-purple" },
  paid: { Icon: CheckCircle2, cls: "bg-success-light text-success-dark dark:text-emerald-400" },
  reminder: { Icon: Send, cls: "bg-info-light text-info-dark dark:text-sky-400" },
};

export function notifIcon(type: string) {
  return MAP[type] ?? { Icon: Info, cls: "bg-info-light text-info-dark dark:text-sky-400" };
}

const ROUTE: Record<string, string> = {
  payment: "/payments",
  due: "/due-payments",
  overdue: "/overdue",
  customer: "/customers",
  loan: "/loans",
  paid: "/loans",
  reminder: "/notifications",
};

export function notifRoute(type: string): string {
  return ROUTE[type] ?? "/notifications";
}
