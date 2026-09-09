"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PillTabs } from "@/components/ui/Tabs";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { usePagination } from "@/lib/hooks/useTableState";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/cn";
import type { Notification } from "@/lib/types";
import { clearAllNotificationsAction, deleteNotificationAction, markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notifications";
import { notifIcon, notifRoute } from "@/components/layout/notif-utils";

const TYPES = [
  ["all", "All"],
  ["unread", "Unread"],
  ["payment", "Payments"],
  ["due", "Due"],
  ["overdue", "Overdue"],
  ["loan", "Loans"],
  ["customer", "Customers"],
  ["paid", "Paid"],
  ["reminder", "Reminders"],
] as const;

export function NotificationsView({ notifications }: { notifications: Notification[] }) {
  const [filter, setFilter] = useState<string>("all");
  const router = useRouter();
  const confirm = useConfirm();
  const [, startTransition] = useTransition();
  const unread = notifications.filter((n) => !n.read).length;

  const filtered = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((n) => !n.read);
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const { page, setPage, totalPages, pageItems, total, startIdx, endIdx } = usePagination(filtered, 12);

  function openNotif(n: Notification) {
    if (!n.read) startTransition(async () => { await markNotificationReadAction(n.id); router.refresh(); });
    router.push(notifRoute(n.type));
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Notifications</h1>
          <p className="text-text-secondary text-[13.5px] mt-0.5">{unread ? `You have ${unread} unread notification${unread === 1 ? "" : "s"}.` : "You are all caught up."}</p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <Button
            variant="secondary"
            disabled={!unread}
            onClick={() =>
              startTransition(async () => {
                await markAllNotificationsReadAction();
                router.refresh();
              })
            }
          >
            <Check /> Mark all as read
          </Button>
          <Button
            variant="ghost"
            className="text-danger"
            onClick={() =>
              confirm({
                title: "Clear all notifications?",
                message: "This removes every notification permanently.",
                confirmText: "Clear All",
                onConfirm: async () => {
                  await clearAllNotificationsAction();
                  router.refresh();
                },
              })
            }
          >
            <Trash2 /> Clear all
          </Button>
        </div>
      </div>
      <Card>
        <div className="p-4 sm:px-[22px] border-b border-border">
          <PillTabs
            tabs={TYPES.map(([k, l]) => ({ key: k, label: k === "unread" ? `${l} (${unread})` : l }))}
            active={filter}
            onChange={(k) => {
              setFilter(k);
              setPage(1);
            }}
          />
        </div>
        {total ? (
          <>
            {pageItems.map((n) => {
              const { Icon, cls } = notifIcon(n.type);
              return (
                <div key={n.id} className={cn("flex gap-3 px-4 sm:px-[22px] py-3 border-b border-border last:border-0 items-start", !n.read && "bg-primary-50/60")}>
                  <button onClick={() => openNotif(n)} className="flex gap-3 flex-1 min-w-0 text-left">
                    <span className={cn("w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0", cls)}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0">
                      <div className="text-[13px] font-medium leading-snug">{n.message}</div>
                      <div className="text-[11.5px] text-text-tertiary mt-0.5">{timeAgo(n.createdAt)}</div>
                    </span>
                  </button>
                  <div className="flex gap-1 shrink-0">
                    {!n.read && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Mark as read"
                        onClick={() =>
                          startTransition(async () => {
                            await markNotificationReadAction(n.id);
                            router.refresh();
                          })
                        }
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-danger"
                      title="Delete"
                      onClick={() =>
                        startTransition(async () => {
                          await deleteNotificationAction(n.id);
                          router.refresh();
                        })
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            <Pagination page={page} totalPages={totalPages} total={total} start={startIdx} end={endIdx} label="notifications" onChange={setPage} />
          </>
        ) : (
          <EmptyState icon={Bell} title="No notifications" text="System events like payments, due dates and new loans will appear here." />
        )}
      </Card>
    </div>
  );
}
