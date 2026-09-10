import { cn } from "@/lib/cn";
import { Spinner } from "@/components/ui/icons";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "soft";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary-600 text-white shadow-card-sm hover:bg-primary-700",
  secondary: "bg-surface border border-border-strong text-text hover:bg-surface-2 hover:border-text-tertiary",
  ghost: "bg-transparent text-text-secondary hover:bg-surface-3 hover:text-text",
  danger: "bg-danger text-white hover:bg-danger-dark",
  success: "bg-success text-white hover:bg-success-dark",
  soft: "bg-primary-50 text-primary-600 hover:bg-primary-100",
};

const SIZES: Record<Size, string> = {
  sm: "px-[11px] py-1.5 text-[12.5px] rounded-lg gap-1.5",
  md: "px-4 py-[9px] text-[13.5px] rounded-[10px] gap-2",
  lg: "px-6 py-[13px] text-[15px] rounded-xl gap-2",
  icon: "w-9 h-9 rounded-[10px] p-0 justify-center",
  "icon-sm": "w-[30px] h-[30px] rounded-lg p-0 justify-center",
};

export function Button({ variant = "primary", size = "md", loading, className, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center font-semibold leading-none whitespace-nowrap transition-all duration-150 select-none border border-transparent",
        "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-55 disabled:pointer-events-none",
        "[&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner className="animate-spin" /> : null}
      {children}
    </button>
  );
}
