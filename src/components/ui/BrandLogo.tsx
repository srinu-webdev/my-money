import { CurrencyInr } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

// The brand mark: a rupee glyph on a solid indigo square. Used at every
// size the logo appears (sidebar, site header, auth panel, favicon), so
// the product reads as one thing everywhere.
export function BrandMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex items-center justify-center rounded-[10px] shrink-0", inverted ? "bg-white text-primary-700" : "bg-primary-600 text-white", className)}
    >
      <CurrencyInr className="w-[58%] h-[58%]" />
    </span>
  );
}

export function BrandLogo({ tagline, className, inverted }: { tagline?: string; className?: string; inverted?: boolean }) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <BrandMark className="w-9 h-9" inverted={inverted} />
      <span className="font-extrabold text-lg leading-tight tracking-tight">
        LendPro
        {tagline ? <small className={cn("block text-[10.5px] font-medium -mt-0.5", inverted ? "text-white/75" : "text-text-tertiary")}>{tagline}</small> : null}
      </span>
    </span>
  );
}
