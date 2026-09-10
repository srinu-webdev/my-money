"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DotsVertical } from "@/components/ui/icons";

export interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  sep?: boolean;
}

export function Dropdown({ trigger, items, align = "right" }: { trigger?: ReactNode; items: DropdownItem[]; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-surface-3 hover:text-text transition-colors"
        aria-label="Actions"
      >
        {trigger ?? <DotsVertical className="w-4 h-4" />}
      </button>
      {open ? (
        <div
          className={cn(
            "absolute top-[calc(100%+6px)] min-w-[190px] bg-surface border border-border rounded-xl shadow-card-lg p-1.5 z-[60] animate-fade-in",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {items.map((item, i) =>
            item.sep ? (
              <div key={i} className="h-px bg-border my-1.5" />
            ) : (
              <button
                key={i}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] font-medium text-left transition-colors [&_svg]:w-[15px] [&_svg]:h-[15px]",
                  item.danger ? "text-danger hover:bg-danger-light" : "text-text hover:bg-surface-3 [&_svg]:text-text-secondary"
                )}
              >
                {item.icon}
                {item.label}
              </button>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}
