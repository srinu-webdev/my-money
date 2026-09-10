import { Check } from "@/components/ui/icons";
import { BrandLogo } from "@/components/ui/BrandLogo";

export function AuthSidePanel({ heading, sub }: { heading: string; sub: string }) {
  return (
    <div className="hidden lg:flex flex-col justify-between p-14 bg-primary-700 text-white">
      <BrandLogo inverted />
      <div>
        <h2 className="text-[34px] font-extrabold leading-tight tracking-tight mb-4">{heading}</h2>
        <p className="opacity-90 text-[15px] leading-relaxed max-w-[420px]">{sub}</p>
        <ul className="mt-7 flex flex-col gap-3">
          {["Interest on outstanding principal, automatically", "Smart interest-first payment allocation", "Due, overdue and reminder workflows", "Reports, charts, CSV and print"].map((t) => (
            <li key={t} className="flex items-center gap-2.5 font-medium text-sm">
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3" />
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="opacity-75 text-xs">© {new Date().getFullYear()} LendPro · Money Lending Management System</div>
    </div>
  );
}
