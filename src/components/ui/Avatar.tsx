import { avatarGradient, initials } from "@/lib/format";
import { cn } from "@/lib/cn";

const SIZES = {
  sm: "w-7 h-7 text-[11px]",
  md: "w-9 h-9 text-[13px]",
  lg: "w-16 h-16 text-[22px]",
  xl: "w-[88px] h-[88px] text-[30px]",
};

export function Avatar({ name, size = "md", src, className }: { name: string; size?: keyof typeof SIZES; src?: string | null; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URLs, not an optimizable static asset
    return <img src={src} alt={name} className={cn("rounded-full object-cover shrink-0", SIZES[size], className)} />;
  }
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-full font-bold text-white shrink-0", SIZES[size], className)}
      style={{ background: avatarGradient(name) }}
    >
      {initials(name)}
    </span>
  );
}
