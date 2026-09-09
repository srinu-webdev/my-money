import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "LendPro — Money Lending Management System",
  description: "Manage Loans. Track Interest. Collect Payments.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning: browser extensions (Grammarly, etc.) inject
          attributes like data-gr-ext-installed onto <body> before React
          hydrates — harmless, but without this it logs a scary console
          error every load. next-themes also needs it here for its
          theme class, which is applied before hydration too. */}
      <body suppressHydrationWarning className={`${inter.variable} font-sans antialiased bg-bg text-text min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
