"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import type { ReactNode } from "react";
import { ModalProvider } from "./ModalProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ModalProvider>
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: { fontFamily: "var(--font-inter)", fontSize: "13.5px" },
          }}
        />
      </ModalProvider>
    </ThemeProvider>
  );
}
