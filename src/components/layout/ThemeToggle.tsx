"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // Standard SSR-hydration guard — see Charts.tsx for the same pattern.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center text-text-secondary hover:bg-surface-3 hover:text-text transition-colors"
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
    >
      {mounted && resolvedTheme === "dark" ? <Sun className="w-[19px] h-[19px]" /> : <Moon className="w-[19px] h-[19px]" />}
    </button>
  );
}
