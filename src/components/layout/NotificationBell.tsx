"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { Notification } from "@/lib/types";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notifications";
import { timeAgo } from "@/lib/dates";
import { notifIcon, notifRoute } from "./notif-utils";

export function NotificationBell({ notifications, unreadCount }: { notifications: Notification[]; unreadCount: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function openNotif(n: Notification) {
    setOpen(false);
    if (!n.read) startTransition(async () => { await markNotificationReadAction(n.id); router.refresh(); });
    router.push(notifRoute(n.type));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-[38px] h-[38px] rounded-[10px] flex items-center justify-center text-text-secondary hover:bg-surface-3 hover:text-text transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-[19px] h-[19px]" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-danger text-white text-[9.5px] font-bold flex items-center justify-center border-2 border-surface">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        // On mobile this is `fixed` and clamped to the viewport by margins
        // instead of anchored to the bell button — the bell isn't the
        // rightmost element in the header (UserMenu sits after it), so a
        // button-anchored `right-0` panel wide enough to be useful
        // overflowed off the LEFT edge of a narrow screen. From `sm:` up
        // there's enough room for the classic anchored-dropdown look.
        <div className="fixed inset-x-4 top-[76px] sm:absolute sm:inset-x-auto sm:left-auto sm:right-0 sm:top-[calc(100%+8px)] w-auto sm:w-[360px] sm:max-w-[calc(100vw-32px)] bg-surface border border-border rounded-2xl shadow-card-lg overflow-hidden z-[200] animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-border font-bold text-sm">
            <span>Notifications</span>
            <button
              className="text-primary text-xs font-semibold hover:underline disabled:opacity-40 disabled:pointer-events-none"
              disabled={!unreadCount}
              onClick={() => startTransition(async () => { await markAllNotificationsReadAction(); router.refresh(); })}
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-7 text-text-secondary text-sm">No notifications yet</div>
            ) : (
              notifications.slice(0, 6).map((n) => (
                <button key={n.id} onClick={() => openNotif(n)} className={cn("flex gap-3 w-full px-4 py-3 border-b border-border last:border-0 text-left hover:bg-surface-2 transition-colors", !n.read && "bg-primary-50/60")}>
                  <NotifIconBadge type={n.type} />
                  <span className="min-w-0">
                    <div className="text-[13px] font-medium leading-snug">{n.message}</div>
                    <div className="text-[11px] text-text-tertiary mt-0.5">{timeAgo(n.createdAt)}</div>
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="p-2.5 text-center border-t border-border">
            <Link href="/notifications" onClick={() => setOpen(false)} className="inline-block px-3 py-1.5 rounded-lg bg-primary-50 text-primary-600 text-[12.5px] font-semibold hover:bg-primary-100">
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function NotifIconBadge({ type }: { type: string }) {
  const { Icon, cls } = notifIcon(type);
  return (
    <span className={cn("w-[34px] h-[34px] rounded-full bg-surface-3 flex items-center justify-center shrink-0", cls)}>
      <Icon className="w-[18px] h-[18px]" />
    </span>
  );
}
