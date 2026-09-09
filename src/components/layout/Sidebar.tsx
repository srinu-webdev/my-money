"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Wallet,
  Percent,
  CalendarDays,
  AlertTriangle,
  FileBarChart,
  TrendingUp,
  Bell,
  Settings,
  UserCircle,
  LogOut,
  ChevronLeft,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { logoutAction } from "@/lib/actions/auth";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  badgeTone?: "danger" | "warning";
}

export function Sidebar({
  dueCount,
  overdueCount,
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapse,
}: {
  dueCount: number;
  overdueCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();

  const overview: NavItem[] = [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }];
  const management: NavItem[] = [
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/loans", label: "Loans", icon: CreditCard },
    { href: "/payments", label: "Payments", icon: Wallet },
    { href: "/interest", label: "Interest", icon: Percent },
    { href: "/due-payments", label: "Due Payments", icon: CalendarDays, badge: dueCount, badgeTone: "warning" },
    { href: "/overdue", label: "Overdue", icon: AlertTriangle, badge: overdueCount, badgeTone: "danger" },
  ];
  const analytics: NavItem[] = [
    { href: "/reports", label: "Reports", icon: FileBarChart },
    { href: "/revenue", label: "Revenue", icon: TrendingUp },
  ];
  const system: NavItem[] = [
    { href: "/notifications", label: "Notifications", icon: Bell },
    { href: "/settings", label: "Settings", icon: Settings },
  ];
  const account: NavItem[] = [{ href: "/profile", label: "Admin Profile", icon: UserCircle }];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const item = (n: NavItem) => (
    <Link
      key={n.href}
      href={n.href}
      onClick={onCloseMobile}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-[10px] font-medium text-[13.5px] mb-0.5 transition-colors relative whitespace-nowrap",
        isActive(n.href) ? "bg-primary-50 text-primary-600 font-semibold dark:text-indigo-300" : "text-text-secondary hover:bg-surface-3 hover:text-text",
        collapsed && "justify-center px-0"
      )}
    >
      <n.icon className="w-[18px] h-[18px] shrink-0" />
      <span className={cn(collapsed && "hidden md:hidden")}>{n.label}</span>
      {n.badge ? (
        <span className={cn("ml-auto text-white text-[10.5px] font-bold px-1.5 py-0.5 rounded-full", n.badgeTone === "danger" ? "bg-danger" : "bg-warning", collapsed && "hidden")}>
          {n.badge}
        </span>
      ) : null}
    </Link>
  );

  const section = (title: string, items: NavItem[]) => (
    <>
      <div className={cn("text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary px-2.5 pt-3.5 pb-1.5", collapsed && "hidden")}>{title}</div>
      {items.map(item)}
    </>
  );

  return (
    <>
      {mobileOpen ? <div className="fixed inset-0 bg-black/50 z-[99] md:hidden" onClick={onCloseMobile} /> : null}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 bg-surface border-r border-border flex flex-col z-[100] transition-[width,transform] duration-200",
          collapsed ? "w-[78px]" : "w-[264px]",
          "md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className={cn("flex items-center gap-3 px-5 h-[68px] border-b border-border shrink-0", collapsed && "justify-center px-0")}>
          <span className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-primary to-purple flex items-center justify-center text-white font-extrabold text-base shrink-0 shadow-[0_4px_12px_rgba(99,102,241,0.35)]">
            L
          </span>
          {!collapsed && (
            <span className="font-extrabold text-lg tracking-tight leading-tight">
              LendPro
              <small className="block text-[10.5px] font-medium text-text-tertiary -mt-0.5">Money Lending System</small>
            </span>
          )}
          <button className="ml-auto md:hidden text-text-secondary" onClick={onCloseMobile} aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={onToggleCollapse}
          className="hidden md:flex absolute -right-3.5 top-20 w-[26px] h-[26px] rounded-full bg-surface border border-border items-center justify-center text-text-secondary shadow-card-sm hover:text-primary hover:border-primary transition-all z-10"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft className={cn("w-[13px] h-[13px] transition-transform", collapsed && "rotate-180")} />
        </button>

        <nav className="flex-1 overflow-y-auto px-3 py-3.5">
          {section("Overview", overview)}
          {section("Management", management)}
          {section("Analytics", analytics)}
          {section("System", system)}
          {section("Account", account)}
          <button
            onClick={() => logoutAction()}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-[10px] font-medium text-[13.5px] w-full text-left text-text-secondary hover:bg-surface-3 hover:text-text transition-colors",
              collapsed && "justify-center px-0"
            )}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            <span className={collapsed ? "hidden" : ""}>Logout</span>
          </button>
        </nav>

        {!collapsed && (
          <div className="px-4 py-3.5 border-t border-border text-[11px] text-text-tertiary leading-relaxed shrink-0">
            Record-keeping tool only. Interest calculations and lending practices should comply with applicable local laws.
          </div>
        )}
      </aside>
    </>
  );
}
