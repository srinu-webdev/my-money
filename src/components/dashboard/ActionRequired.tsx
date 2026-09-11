import Link from "next/link";
import { AlertTriangle, Clock, ChevronRight } from "@/components/ui/icons";
import type { IconComponent } from "@/components/ui/icons";
import { Card, CardHeader } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";

type Tone = "danger" | "warning" | "info";

const TONE = {
  danger: { icon: "text-danger", bg: "bg-danger-light", text: "text-danger" },
  warning: { icon: "text-warning-dark dark:text-amber-400", bg: "bg-warning-light", text: "text-warning-dark dark:text-amber-400" },
  info: { icon: "text-info-dark dark:text-sky-400", bg: "bg-info-light", text: "text-info-dark dark:text-sky-400" },
} satisfies Record<Tone, { icon: string; bg: string; text: string }>;

function Row({ icon: Icon, tone, title, primary, secondary, href, cta }: { icon: IconComponent; tone: Tone; title: string; primary: string; secondary: string; href: string; cta: string }) {
  const t = TONE[tone];
  return (
    <Link href={href} className="flex items-center gap-3.5 px-4 sm:px-[22px] py-3.5 hover:bg-surface-2 transition-colors group">
      <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", t.bg)}>
        <Icon className={cn("w-[18px] h-[18px]", t.icon)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold">
          {title} — <span className={t.text}>{primary}</span>
        </div>
        <div className="text-[12px] text-text-tertiary mt-0.5">{secondary}</div>
      </div>
      <div className={cn("text-[12.5px] font-semibold shrink-0 flex items-center gap-0.5 group-hover:gap-1.5 transition-all", t.text)}>
        {cta}
        <ChevronRight className="w-3.5 h-3.5" />
      </div>
    </Link>
  );
}

export function ActionRequired({
  className,
  overdueLoans,
  overdueAmount,
  upcomingDueLoans,
  upcomingDue,
  interestPending,
}: {
  className?: string;
  overdueLoans: number;
  overdueAmount: number;
  upcomingDueLoans: number;
  upcomingDue: number;
  interestPending: number;
}) {
  const nothingToDo = overdueLoans === 0 && upcomingDueLoans === 0 && interestPending < 1;

  return (
    <Card className={className}>
      <CardHeader title="Action Required" sub="What needs attention right now" />
      {nothingToDo ? (
        <div className="p-8 text-center text-text-tertiary text-sm">Nothing needs your attention — everything&rsquo;s on track.</div>
      ) : (
        <div className="divide-y divide-border">
          {overdueLoans > 0 && (
            <Row icon={AlertTriangle} tone="danger" title="Loans overdue" primary={String(overdueLoans)} secondary={`${formatCurrency(overdueAmount)} overdue`} href="/overdue" cta="View loans" />
          )}
          {upcomingDueLoans > 0 && (
            <Row icon={Clock} tone="warning" title="Due within 7 days" primary={String(upcomingDueLoans)} secondary={`${formatCurrency(upcomingDue)} expected`} href="/due-payments" cta="View due payments" />
          )}
          {interestPending >= 1 && (
            <Row icon={Clock} tone="info" title="Interest pending" primary={formatCurrency(interestPending)} secondary="Accrued portfolio-wide, not yet collected" href="/interest" cta="View interest" />
          )}
        </div>
      )}
    </Card>
  );
}
