import { Check } from "lucide-react";

export function AuthSidePanel({ heading, sub }: { heading: string; sub: string }) {
  return (
    <div className="hidden lg:flex flex-col justify-between p-14 relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary to-purple text-white">
      <div className="absolute w-[520px] h-[520px] rounded-full bg-white/8 -top-40 -right-40" />
      <div className="absolute w-[380px] h-[380px] rounded-full bg-white/6 -bottom-32 -left-24" />
      <div className="flex items-center gap-3 relative">
        <span className="w-9 h-9 rounded-[10px] bg-white/20 flex items-center justify-center font-extrabold text-base">L</span>
        <span className="font-extrabold text-lg">LendPro</span>
      </div>
      <div className="relative">
        <h2 className="text-[34px] font-extrabold leading-tight tracking-tight mb-4">{heading}</h2>
        <p className="opacity-90 text-[15px] leading-relaxed max-w-[420px]">{sub}</p>
        <ul className="mt-7 flex flex-col gap-3">
          {["Interest on outstanding principal, automatically", "Smart interest-first payment allocation", "Due, overdue and reminder workflows", "Reports, charts, CSV and print"].map((t) => (
            <li key={t} className="flex items-center gap-2.5 font-medium text-sm">
              <Check className="w-5 h-5 bg-white/20 rounded-md p-1 shrink-0" /> {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="opacity-75 text-xs relative">© {new Date().getFullYear()} LendPro · Money Lending Management System</div>
    </div>
  );
}
