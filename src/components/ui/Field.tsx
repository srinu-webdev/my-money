import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldBase =
  "w-full px-3 py-2.5 border border-border-strong rounded-[10px] bg-surface text-text outline-none transition-[border-color,box-shadow] duration-150 " +
  "focus:border-primary focus:ring-[3px] focus:ring-primary/20 disabled:bg-surface-3 disabled:text-text-tertiary disabled:cursor-not-allowed " +
  "placeholder:text-text-tertiary";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "min-h-[84px] resize-y", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, "appearance-none bg-no-repeat pr-8 cursor-pointer", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%236b7280' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundPosition: "right 10px center" }} {...props}>
      {children}
    </select>
  );
}

export function FormGroup({ label, required, hint, error, children, className }: { label?: string; required?: boolean; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label className="text-[12.5px] font-semibold text-text-secondary">
          {label} {required ? <span className="text-danger">*</span> : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? <span className="text-[11.5px] text-text-tertiary">{hint}</span> : null}
      {error ? <span className="text-xs font-medium text-danger">{error}</span> : null}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: { label: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("inline-flex items-center gap-2 cursor-pointer text-[13px] text-text-secondary", className)}>
      <input type="checkbox" className="w-4 h-4 accent-primary cursor-pointer" {...props} />
      {label}
    </label>
  );
}
