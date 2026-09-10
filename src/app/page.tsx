"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Users, CreditCard, Percent, Wallet, AlertTriangle, FileBarChart, CheckCircle, ShieldCheck, Menu, X } from "@/components/ui/icons";
import { BrandLogo } from "@/components/ui/BrandLogo";

const NAV_LINKS: [string, string][] = [
  ["#home", "Home"],
  ["#features", "Features"],
  ["#how", "How It Works"],
  ["#reports", "Reports"],
  ["#about", "About"],
];

// Reveals a section as it scrolls into view — the only "motion" this page
// uses. Same brand look as the rest of the app (indigo/white, Inter, no
// gradients or pastel icon tiles); just a bit more alive than a static page.
function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const features = [
    { title: "Customer Management", text: "Maintain complete borrower profiles with contact details, KYC notes, status and full financial history in one place.", icon: Users },
    { title: "Loan Management", text: "Issue loans with flexible interest — percentage or fixed, daily to yearly — and track every rupee from disbursement to closure.", icon: CreditCard },
    { title: "Interest Tracking", text: "Interest accrues automatically on outstanding principal. Always know what is earned, collected and pending.", icon: Percent },
    { title: "Payment Collection", text: "Record cash, UPI, bank or cheque payments with smart interest-first allocation or fully custom splits.", icon: Wallet },
    { title: "Due & Overdue Tracking", text: "See what is due today, tomorrow and this week. Chase overdue accounts with one-click reminders.", icon: AlertTriangle },
    { title: "Reports & Analytics", text: "Monthly lending, collections and interest charts plus CSV export and print-ready statements.", icon: FileBarChart },
  ];
  const steps = [
    ["Add Customer", "Register the borrower with contact and address details."],
    ["Create Loan", "Set principal, interest rate, frequency and due date."],
    ["Track Interest", "Interest accrues automatically on the outstanding balance."],
    ["Collect Payment", "Record payments and allocate to interest and principal."],
    ["Monitor Outstanding", "Watch dues, overdue accounts and total exposure live."],
  ];
  const bars = [38, 55, 46, 70, 62, 84, 74, 92, 80, 96];
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 bg-surface/85 backdrop-blur-md border-b border-border">
        <div className="max-w-[1180px] mx-auto px-6 h-[70px] flex items-center gap-6">
          <Link href="#home">
            <BrandLogo tagline="Money Lending Management" />
          </Link>
          <div className="hidden md:flex gap-6 ml-6">
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} className="font-medium text-text-secondary text-sm hover:text-text transition-colors">
                {label}
              </a>
            ))}
          </div>
          <div className="ml-auto flex gap-2.5 items-center">
            <Link href="/login" className="hidden sm:inline-flex px-4 py-2 rounded-[10px] text-[13.5px] font-semibold border border-border-strong hover:bg-surface-2 transition-colors">
              Admin Login
            </Link>
            <Link href="/signup" className="inline-flex px-4 py-2 rounded-[10px] text-[13.5px] font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors">
              Get Started
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-[10px] border border-border-strong text-text-secondary hover:bg-surface-2 transition-colors"
            >
              {menuOpen ? <X className="w-[18px] h-[18px]" /> : <Menu className="w-[18px] h-[18px]" />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden border-t border-border bg-surface"
            >
              <div className="px-6 py-3 flex flex-col gap-1">
                {NAV_LINKS.map(([href, label]) => (
                  <a key={href} href={href} onClick={() => setMenuOpen(false)} className="py-2 font-medium text-text-secondary text-sm hover:text-text transition-colors">
                    {label}
                  </a>
                ))}
                <Link href="/login" onClick={() => setMenuOpen(false)} className="py-2 font-medium text-text-secondary text-sm hover:text-text transition-colors sm:hidden">
                  Admin Login
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <section id="home" className="max-w-[1180px] mx-auto px-6 py-16 lg:py-24 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
        <div className="text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-primary-50 text-primary-600 font-semibold text-[12.5px] px-3 py-1.5 rounded-full mb-5"
          >
            <ShieldCheck className="w-4 h-4" /> Manage Loans. Track Interest. Collect Payments.
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] mb-5"
          >
            Manage Your Money Lending Business <span className="text-primary-600">With Confidence</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="text-lg text-text-secondary leading-relaxed max-w-[520px] mx-auto lg:mx-0 mb-7"
          >
            Track customers, loans, interest, payments, pending amounts and overdue collections from one professional dashboard.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24 }}
            className="flex flex-wrap gap-3 justify-center lg:justify-start"
          >
            <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-[15px] font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors">
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#features" className="inline-flex items-center px-6 py-3.5 rounded-xl text-[15px] font-semibold border border-border-strong hover:bg-surface-2 transition-colors">
              Explore Features
            </a>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.32 }}
            className="flex flex-wrap gap-7 justify-center lg:justify-start mt-10"
          >
            {[["100%", "Dynamic calculations"], ["4", "Interest frequencies"], ["5", "Payment methods"], ["Live", "Overdue tracking"]].map(([n, l]) => (
              <div key={l}>
                <b className="block text-[22px] font-extrabold tracking-tight">{n}</b>
                <span className="text-[12.5px] text-text-secondary">{l}</span>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative max-w-[560px] mx-auto w-full"
        >
          <div className="bg-surface border border-border rounded-[20px] shadow-card-lg p-[18px]">
            <div className="grid grid-cols-3 gap-2.5 mb-3">
              {[["Money Lent", "₹48,50,000", "12%"], ["Interest Earned", "₹8,42,500", "8.4%"], ["Collected", "₹24,60,000", "5.1%"]].map(([l, v, p]) => (
                <div key={l} className="bg-surface-2 border border-border rounded-xl p-3">
                  <small className="text-[10px] text-text-tertiary font-semibold uppercase tracking-wide">{l}</small>
                  <b className="block text-[15px] font-extrabold mt-1 tracking-tight">{v}</b>
                  <em className="not-italic text-[10px] text-success-dark font-semibold">▲ {p}</em>
                </div>
              ))}
            </div>
            <div className="flex items-end gap-1.5 h-[110px] p-3.5 bg-surface-2 border border-border rounded-xl mb-3">
              {bars.map((h, i) => (
                <i key={i} className="flex-1 rounded-t-[5px] rounded-b-sm bg-primary-600 opacity-80 block" style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="text-[11.5px]">
              {[["Ravi Kumar · LN-2026-0012", "₹5,000 paid", "text-success-dark"], ["Priya Sharma · LN-2026-0007", "Due tomorrow", "text-warning-dark"], ["Suresh Reddy · LN-2026-0003", "4 days overdue", "text-danger"]].map(([l, v, cls]) => (
                <div key={l} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <span>{l}</span>
                  <b className={`font-semibold ${cls}`}>{v}</b>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      <section id="features" className="max-w-[1180px] mx-auto px-6 py-16 lg:py-20">
        <Reveal className="text-center mb-11">
          <div className="text-primary font-bold text-[12.5px] uppercase tracking-widest mb-2.5">Features</div>
          <h2 className="text-[28px] sm:text-[34px] font-extrabold tracking-tight mb-3">Everything a lending business needs</h2>
          <p className="text-text-secondary text-[15.5px] max-w-[560px] mx-auto">Built for money lenders, chit operators and micro-finance desks who need accurate books without spreadsheets.</p>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={Math.min(i, 3) * 0.06}>
              <div className="bg-surface border border-border rounded-2xl p-6 hover:shadow-card-md hover:border-primary-200 transition-all duration-200 h-full">
                <f.icon className="w-8 h-8 text-primary-600 mb-4" />
                <h3 className="text-[16.5px] font-bold mb-2">{f.title}</h3>
                <p className="text-text-secondary text-[13.5px] leading-relaxed">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="how" className="max-w-[1180px] mx-auto px-6 py-16 lg:py-20 pt-0">
        <Reveal className="text-center mb-11">
          <div className="text-primary font-bold text-[12.5px] uppercase tracking-widest mb-2.5">How It Works</div>
          <h2 className="text-[28px] sm:text-[34px] font-extrabold tracking-tight">From first loan to final payment in five steps</h2>
        </Reveal>
        <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {steps.map(([title, text], i) => (
            <Reveal key={title} delay={Math.min(i, 4) * 0.06}>
              <div className="text-center p-6 bg-surface border border-border rounded-2xl h-full">
                <div className="w-11 h-11 rounded-full bg-primary-600 text-white font-extrabold flex items-center justify-center mx-auto mb-3.5 text-[15px]">{i + 1}</div>
                <h4 className="text-[14.5px] font-bold mb-1.5">{title}</h4>
                <p className="text-[12.5px] text-text-secondary leading-relaxed">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="reports" className="max-w-[1180px] mx-auto px-6 py-16 lg:py-20 pt-0">
        <Reveal className="bg-surface border border-border rounded-[22px] p-8 sm:p-10 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-primary font-bold text-[12.5px] uppercase tracking-widest mb-2.5">Reports &amp; Analytics</div>
            <h2 className="text-[26px] sm:text-[30px] font-extrabold tracking-tight mb-1">Know your numbers at a glance</h2>
            <ul className="flex flex-col gap-3 mt-5">
              {["Monthly lending, collections and interest trends", "Total outstanding, pending interest and overdue exposure", "Customer growth and loan status breakdown", "One-click CSV export and print-ready statements"].map((t) => (
                <li key={t} className="flex items-center gap-2.5 font-medium text-sm">
                  <CheckCircle className="w-[18px] h-[18px] text-success shrink-0" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[["Principal Outstanding", "₹32,80,000"], ["Interest Pending", "₹1,24,000"], ["Upcoming Due", "₹1,85,000"], ["Overdue Amount", "₹2,40,000", "text-danger"]].map(([l, v, cls]) => (
              <div key={l} className="bg-surface-2 border border-border rounded-2xl p-4">
                <small className="text-[11px] text-text-tertiary font-semibold uppercase tracking-wide">{l}</small>
                <b className={`block text-[19px] font-extrabold mt-1 tracking-tight ${cls ?? ""}`}>{v}</b>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section id="about" className="max-w-[1180px] mx-auto px-6 py-16 lg:py-20 pt-0">
        <Reveal className="bg-primary-700 text-white rounded-[24px] p-10 sm:p-14 text-center">
          <h2 className="text-[26px] sm:text-[32px] font-extrabold tracking-tight mb-3.5">About LendPro</h2>
          <p className="max-w-[640px] mx-auto opacity-90 text-[15.5px] leading-relaxed mb-6">
            LendPro is a record-keeping and management tool for small and mid-size lending businesses. It replaces notebooks and spreadsheets with a dependable ledger that calculates interest, allocates payments and highlights what needs your attention today.
          </p>
          <Link href="/login" className="inline-flex px-6 py-3.5 rounded-xl text-[15px] font-semibold bg-white text-primary-700 hover:bg-primary-50 transition-colors">
            Open Admin Dashboard
          </Link>
        </Reveal>
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-text-tertiary text-[12.5px] leading-relaxed">
        <div>
          <strong>LendPro</strong> · Money Lending Management System
        </div>
        <div className="mt-2 max-w-2xl mx-auto">
          This software is a record-keeping and management tool. Interest calculations and lending practices should comply with applicable local laws and regulations. It does not constitute legal or financial advice.
        </div>
      </footer>
    </div>
  );
}
