"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { Notification } from "@/lib/types";

export function DashboardShell({
  children,
  dueCount,
  overdueCount,
  adminName,
  adminAvatar,
  notifications,
  unreadCount,
}: {
  children: ReactNode;
  dueCount: number;
  overdueCount: number;
  adminName: string;
  adminAvatar: string | null;
  notifications: Notification[];
  unreadCount: number;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer on every route change (an external event, not
  // derivable from props/state) and read the collapse preference from
  // localStorage, a browser-only API unavailable during SSR — both are
  // genuine "synchronize with an external system" effects.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMobileOpen(false), [pathname]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setCollapsed(localStorage.getItem("lendpro_sidebar_collapsed") === "1"), []);

  function toggleCollapse() {
    setCollapsed((c) => {
      localStorage.setItem("lendpro_sidebar_collapsed", !c ? "1" : "");
      return !c;
    });
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        dueCount={dueCount}
        overdueCount={overdueCount}
        adminName={adminName}
        adminAvatar={adminAvatar}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />
      <div className={cn("flex-1 min-w-0 flex flex-col transition-[margin] duration-200", collapsed ? "md:ml-[78px]" : "md:ml-[264px]")}>
        <Topbar adminName={adminName} adminAvatar={adminAvatar} notifications={notifications} unreadCount={unreadCount} onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-7 pb-10">{children}</main>
      </div>
    </div>
  );
}
