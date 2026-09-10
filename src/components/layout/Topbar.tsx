"use client";

import { Menu } from "@/components/ui/icons";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import type { Notification } from "@/lib/types";

export function Topbar({
  adminName,
  adminAvatar,
  notifications,
  unreadCount,
  onOpenMobile,
}: {
  adminName: string;
  adminAvatar: string | null;
  notifications: Notification[];
  unreadCount: number;
  onOpenMobile: () => void;
}) {
  const today = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return (
    <header className="h-[68px] bg-surface border-b border-border flex items-center gap-3.5 px-4 sm:px-6 sticky top-0 z-[90]">
      <button onClick={onOpenMobile} className="md:hidden w-9 h-9 rounded-[10px] flex items-center justify-center text-text-secondary hover:bg-surface-3" aria-label="Menu">
        <Menu className="w-5 h-5" />
      </button>
      <GlobalSearch />
      <div className="hidden lg:block ml-auto text-[12.5px] text-text-secondary font-medium whitespace-nowrap">{today}</div>
      <div className="flex items-center gap-1.5 shrink-0 ml-auto lg:ml-0">
        <ThemeToggle />
        <NotificationBell notifications={notifications} unreadCount={unreadCount} />
        <UserMenu name={adminName} avatar={adminAvatar} />
      </div>
    </header>
  );
}
