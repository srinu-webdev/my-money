import Link from "next/link";
import {
  Users,
  Edit,
  Trash2,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Send,
  Lock,
  LogOut,
  Settings,
  UserCircle,
  Activity as ActivityIcon,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime, timeAgo } from "@/lib/dates";
import type { Activity } from "@/lib/types";

const ICON_MAP: Record<string, { Icon: LucideIcon; cls: string }> = {
  customer_created: { Icon: Users, cls: "bg-primary-50 text-primary-600" },
  customer_edited: { Icon: Edit, cls: "bg-primary-50 text-primary-600" },
  customer_deleted: { Icon: Trash2, cls: "bg-danger-light text-danger" },
  loan_created: { Icon: CreditCard, cls: "bg-purple/10 text-purple" },
  loan_edited: { Icon: Edit, cls: "bg-purple/10 text-purple" },
  loan_deleted: { Icon: Trash2, cls: "bg-danger-light text-danger" },
  loan_closed: { Icon: CheckCircle2, cls: "bg-success-light text-success-dark" },
  loan_cancelled: { Icon: AlertTriangle, cls: "bg-warning-light text-warning-dark" },
  loan_paid: { Icon: CheckCircle2, cls: "bg-success-light text-success-dark" },
  payment_recorded: { Icon: Wallet, cls: "bg-success-light text-success-dark" },
  payment_edited: { Icon: Edit, cls: "bg-info-light text-info-dark" },
  payment_deleted: { Icon: Trash2, cls: "bg-danger-light text-danger" },
  reminder_sent: { Icon: Send, cls: "bg-info-light text-info-dark" },
  admin_login: { Icon: Lock, cls: "bg-info-light text-info-dark" },
  admin_logout: { Icon: LogOut, cls: "bg-info-light text-info-dark" },
  settings_updated: { Icon: Settings, cls: "bg-info-light text-info-dark" },
  profile_updated: { Icon: UserCircle, cls: "bg-info-light text-info-dark" },
};

export function ActivityList({ activities, emptyText, showLinks = true }: { activities: Activity[]; emptyText?: string; showLinks?: boolean }) {
  if (!activities.length) return <EmptyState icon={ActivityIcon} title="No activity yet" text={emptyText ?? "Actions you take will appear here."} />;
  return (
    <div className="flex flex-col">
      {activities.map((a) => {
        const { Icon, cls } = ICON_MAP[a.type] ?? { Icon: ActivityIcon, cls: "bg-info-light text-info-dark" };
        return (
          <div key={a.id} className="flex gap-3 px-4 sm:px-[22px] py-3 border-b border-border last:border-0 items-start">
            <span className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0 ${cls}`}>
              <Icon className="w-4 h-4" />
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
