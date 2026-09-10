import Link from "next/link";
import {
  Users,
  Edit,
  Trash,
  CreditCard,
  CheckCircle,
  AlertTriangle,
  Wallet,
  Send,
  Lock,
  LogOut,
  Settings,
  UserCircle,
  Activity as ActivityIcon,
  type IconComponent,
} from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime, timeAgo } from "@/lib/dates";
import type { Activity } from "@/lib/types";

// `cls` colours the icon only; the badge behind it is a neutral circle.
const ICON_MAP: Record<string, { Icon: IconComponent; cls: string }> = {
  customer_created: { Icon: Users, cls: "text-primary-600 dark:text-indigo-300" },
  customer_edited: { Icon: Edit, cls: "text-primary-600 dark:text-indigo-300" },
  customer_deleted: { Icon: Trash, cls: "text-danger dark:text-red-400" },
  loan_created: { Icon: CreditCard, cls: "text-purple" },
  loan_edited: { Icon: Edit, cls: "text-purple" },
  loan_deleted: { Icon: Trash, cls: "text-danger dark:text-red-400" },
  loan_closed: { Icon: CheckCircle, cls: "text-success-dark dark:text-emerald-400" },
  loan_cancelled: { Icon: AlertTriangle, cls: "text-warning-dark dark:text-amber-400" },
  loan_paid: { Icon: CheckCircle, cls: "text-success-dark dark:text-emerald-400" },
  payment_recorded: { Icon: Wallet, cls: "text-success-dark dark:text-emerald-400" },
  payment_edited: { Icon: Edit, cls: "text-info-dark dark:text-sky-400" },
  payment_deleted: { Icon: Trash, cls: "text-danger dark:text-red-400" },
  reminder_sent: { Icon: Send, cls: "text-info-dark dark:text-sky-400" },
  admin_login: { Icon: Lock, cls: "text-info-dark dark:text-sky-400" },
  admin_logout: { Icon: LogOut, cls: "text-info-dark dark:text-sky-400" },
  settings_updated: { Icon: Settings, cls: "text-info-dark dark:text-sky-400" },
  profile_updated: { Icon: UserCircle, cls: "text-info-dark dark:text-sky-400" },
};

export function ActivityList({ activities, emptyText, showLinks = true }: { activities: Activity[]; emptyText?: string; showLinks?: boolean }) {
  if (!activities.length) return <EmptyState icon={ActivityIcon} title="No activity yet" text={emptyText ?? "Actions you take will appear here."} />;
  return (
    <div className="flex flex-col">
      {activities.map((a) => {
        const { Icon, cls } = ICON_MAP[a.type] ?? { Icon: ActivityIcon, cls: "text-info-dark dark:text-sky-400" };
        return (
          <div key={a.id} className="flex gap-3 px-4 sm:px-[22px] py-3 border-b border-border last:border-0 items-start">
            <span className={`w-[34px] h-[34px] rounded-full bg-surface-3 flex items-center justify-center shrink-0 ${cls}`}>
              <Icon className="w-[18px] h-[18px]" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium leading-snug">{a.description}</div>
              <div className="text-[11.5px] text-text-tertiary mt-0.5">
                {formatDateTime(a.createdAt)} · {timeAgo(a.createdAt)}
              </div>
            </div>
            {showLinks && a.loanId ? (
              <Link href={`/loans/${a.loanId}`} className="text-primary text-xs font-semibold hover:underline shrink-0">
                View
              </Link>
            ) : showLinks && a.customerId ? (
              <Link href={`/customers/${a.customerId}`} className="text-primary text-xs font-semibold hover:underline shrink-0">
                View
              </Link>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
