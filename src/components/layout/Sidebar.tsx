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
  LogOut,
  ChevronLeft,
  X,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { BrandMark } from "@/components/ui/BrandLogo";
import { Avatar } from "@/components/ui/Avatar";
import { logoutAction } from "@/lib/actions/auth";

// Deliberately dark, always — a persistent navy sidebar next to a light
// content area is the standard premium-fintech layout (Stripe, Linear,
// Mercury) and reads as more "product," not tied to the app's own
// light/dark theme toggle (which only affects the main content surfaces).
// Colors are inlined as Tailwind arbitrary values below (slate-900/800/500/400).

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
  adminName,
  adminAvatar,
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapse,
}: {
  dueCount: number;
  overdueCount: number;
  adminName: string;
  adminAvatar: string | null;
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

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const item = (n: NavItem) => (
    <Link
      key={n.href}
      href={n.href}
      onClick={onCloseMobile}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-[10px] font-medium text-[13.5px] mb-0.5 transition-colors relative whitespace-nowrap",
        isActive(n.href) ? "bg-primary-600 text-white font-semibold shadow-[0_1px_2px_rgba(0,0,0,.3)]" : "text-[#94a3b8] hover:bg-[#1e293b] hover:text-[#f1f5f9]",
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
      <div className={cn("text-[10.5px] font-bold uppercase tracking-wider text-[#64748b] px-2.5 pt-3.5 pb-1.5", collapsed && "hidden")}>{title}</div>
      {items.map(item)}
    </>
  );

  return (
    <>
      {mobileOpen ? <div className="fixed inset-0 bg-black/50 z-[99] md:hidden" onClick={onCloseMobile} /> : null}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 bg-[#0f172a] border-r border-[#1e293b] flex flex-col z-[100] transition-[width,transform] duration-200",
          collapsed ? "w-[78px]" : "w-[264px]",
          "md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className={cn("flex items-center gap-3 px-5 h-[68px] border-b border-[#1e293b] shrink-0", collapsed && "justify-center px-0")}>
          <BrandMark className="w-9 h-9" />
          {!collapsed && (
            <span className="font-extrabold text-lg tracking-tight leading-tight text-white">
              LendPro
              <small className="block text-[10.5px] font-medium text-[#64748b] -mt-0.5">Money Lending System</small>
            </span>
          )}
          <button className="ml-auto md:hidden text-[#94a3b8] hover:text-white" onClick={onCloseMobile} aria-label="Close menu">
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

        {/* min-h-0 is load-bearing: a flex item with overflow-y-auto won't
            shrink below its own content height without it, so on shorter
            screens this nav would push past the fixed-height aside and
            crowd/clip the footer card and disclaimer below instead of
            scrolling internally. */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-3.5">
          {section("Overview", overview)}
          {section("Management", management)}
          {section("Analytics", analytics)}
          {section("System", system)}
        </nav>

        {!collapsed && (
          <div className="p-3.5 border-t border-[#1e293b] shrink-0">
            <div className="flex items-center gap-2.5 rounded-[12px] p-2 hover:bg-[#1e293b] transition-colors">
              <Link href="/profile" className="flex items-center gap-2.5 min-w-0 flex-1">
                <Avatar name={adminName} src={adminAvatar} size="sm" />
                <span className="min-w-0">
                  <div className="text-[13px] font-semibold text-[#f1f5f9] truncate">{adminName}</div>
                  <div className="text-[11px] text-[#64748b]">Administrator</div>
                </span>
              </Link>
              <button onClick={() => logoutAction()} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[#64748b] hover:bg-[#0f172a] hover:text-[#f1f5f9] transition-colors" aria-label="Logout">
                <LogOut className="w-[17px] h-[17px]" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
