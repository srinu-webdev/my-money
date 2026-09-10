import { Wallet, CalendarDays, AlertTriangle, Users, CreditCard, CheckCircle, Send, Info, type IconComponent } from "@/components/ui/icons";

// `cls` is the icon's ink colour only; the surrounding badge is a neutral
// circle (see NotifIconBadge) so the colour codes the event without
// turning every row into a coloured tile.
const MAP: Record<string, { Icon: IconComponent; cls: string }> = {
  payment: { Icon: Wallet, cls: "text-success-dark dark:text-emerald-400" },
  due: { Icon: CalendarDays, cls: "text-warning-dark dark:text-amber-400" },
  overdue: { Icon: AlertTriangle, cls: "text-danger dark:text-red-400" },
  customer: { Icon: Users, cls: "text-primary-600 dark:text-indigo-300" },
  loan: { Icon: CreditCard, cls: "text-purple" },
  paid: { Icon: CheckCircle, cls: "text-success-dark dark:text-emerald-400" },
  reminder: { Icon: Send, cls: "text-info-dark dark:text-sky-400" },
};

export function notifIcon(type: string) {
  return MAP[type] ?? { Icon: Info, cls: "text-info-dark dark:text-sky-400" };
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
