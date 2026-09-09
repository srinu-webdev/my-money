import { cn } from "@/lib/cn";
import type { ReactNode, TableHTMLAttributes, ThHTMLAttributes } from "react";

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-[13px]", className)} {...props} />;
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "text-left px-3.5 py-3 text-[11.5px] font-semibold text-text-secondary uppercase tracking-wide border-b border-border bg-surface-2 whitespace-nowrap",
        className
      )}
      {...props}
    />
  );
}

export function SortTh({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void; className?: string }) {
  return (
    <Th className={cn("cursor-pointer select-none hover:text-text", className)} onClick={onClick}>
      {label}
      <span className={cn("ml-1 text-[10px]", active ? "text-primary opacity-100" : "opacity-35")}>{active ? (dir === "asc" ? "▲" : "▼") : "⇅"}</span>
    </Th>
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3.5 py-3.5 border-b border-border align-middle whitespace-nowrap", className)} {...props} />;
}
