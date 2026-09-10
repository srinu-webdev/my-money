import type { ReactNode } from "react";
import type { IconComponent } from "@/components/ui/icons";

export function EmptyState({ icon: Icon, title, text, action }: { icon: IconComponent; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-12 px-6 text-text-secondary">
      <div className="w-16 h-16 rounded-full bg-surface-3 flex items-center justify-center mx-auto mb-4 text-text-tertiary">
        <Icon className="w-7 h-7" />
      </div>
      <h4 className="text-[15px] text-text font-semibold mb-1.5">{title}</h4>
      {text ? <p className="text-[13px] max-w-[360px] mx-auto mb-4">{text}</p> : null}
      {action}
    </div>
  );
}
