import { redirect } from "next/navigation";
import { getAllLoansWithBalance, getAllNotifications, getCurrentAdmin, getUnreadNotificationCount } from "@/lib/queries";
import { addDays, todayStr, toISODate } from "@/lib/dates";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login"); // defense-in-depth; middleware already covers this

  const [loans, notifications, unreadCount] = await Promise.all([getAllLoansWithBalance(), getAllNotifications(), getUnreadNotificationCount()]);

  const today = todayStr();
  const tomorrow = toISODate(addDays(new Date(), 1));
  let dueCount = 0;
  let overdueCount = 0;
  for (const l of loans) {
    if (l.derivedStatus === "OVERDUE") overdueCount++;
    else if (l.derivedStatus !== "PAID" && l.derivedStatus !== "CANCELLED" && (l.dueDate === today || l.dueDate === tomorrow)) dueCount++;
  }

  return (
    <DashboardShell dueCount={dueCount} overdueCount={overdueCount} adminName={admin.name} adminAvatar={admin.avatar} notifications={notifications.slice(0, 20)} unreadCount={unreadCount}>
      {children}
    </DashboardShell>
  );
}
