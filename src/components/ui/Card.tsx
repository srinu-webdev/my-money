import { cn } from "@/lib/cn";
import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // min-w-0 overrides the flex/grid item default of min-width:auto — without
  // it, a Card holding a wide table (even one wrapped in overflow-x-auto)
  // forces its whole flex/grid track wider than the container instead of
  // scrolling internally, breaking layout on every narrower device.
  return <div className={cn("bg-surface border border-border rounded-2xl shadow-card-sm min-w-0", className)} {...props} />;
}

export function CardHeader({ title, sub, actions, className }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("px-[22px] py-[18px] border-b border-border flex items-center justify-between gap-3 flex-wrap", className)}>
      <div>
        <h3 className="text-[15px] font-bold">{title}</h3>
        {sub ? <div className="text-[12.5px] text-text-secondary mt-0.5 font-normal">{sub}</div> : null}
      </div>
      {actions}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-[22px]", className)} {...props} />;
}
