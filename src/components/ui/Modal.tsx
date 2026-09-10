import { X } from "@/components/ui/icons";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function ModalHeader({ title, sub, onClose }: { title: ReactNode; sub?: ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
      <div>
        <h3 className="text-[17px] font-bold">{title}</h3>
        {sub ? <div className="text-[12.5px] text-text-secondary font-normal mt-0.5">{sub}</div> : null}
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:bg-surface-3 hover:text-text transition-colors">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

export function ModalBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-6 py-[22px] overflow-y-auto flex-1", className)}>{children}</div>;
}

export function ModalFooter({ between, children }: { between?: boolean; children: ReactNode }) {
  return <div className={cn("flex gap-2.5 px-6 py-4 border-t border-border flex-wrap shrink-0", between ? "justify-between" : "justify-end")}>{children}</div>;
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div className="mt-3.5 bg-danger-light text-danger-dark dark:text-red-300 px-3.5 py-2.5 rounded-[10px] text-[13px] font-medium">{message}</div>;
}
