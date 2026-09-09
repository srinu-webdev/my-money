import Link from "next/link";
import {
  ArrowRight,
  Users,
  CreditCard,
  Percent,
  Wallet,
  AlertTriangle,
  FileBarChart,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";

export default function LandingPage() {
  const features = [
    { title: "Customer Management", text: "Maintain complete borrower profiles with contact details, KYC notes, status and full financial history in one place.", icon: Users, cls: "bg-primary-50 text-primary-600" },
    { title: "Loan Management", text: "Issue loans with flexible interest — percentage or fixed, daily to yearly — and track every rupee from disbursement to closure.", icon: CreditCard, cls: "bg-purple/10 text-purple" },
    { title: "Interest Tracking", text: "Interest accrues automatically on outstanding principal. Always know what is earned, collected and pending.", icon: Percent, cls: "bg-success-light text-success-dark" },
    { title: "Payment Collection", text: "Record cash, UPI, bank or cheque payments with smart interest-first allocation or fully custom splits.", icon: Wallet, cls: "bg-info-light text-info-dark" },
    { title: "Due & Overdue Tracking", text: "See what is due today, tomorrow and this week. Chase overdue accounts with one-click reminders.", icon: AlertTriangle, cls: "bg-warning-light text-warning-dark" },
    { title: "Reports & Analytics", text: "Monthly lending, collections and interest charts plus CSV export and print-ready statements.", icon: FileBarChart, cls: "bg-danger-light text-danger" },
  ];
  const steps = [
    ["Add Customer", "Register the borrower with contact and address details."],
    ["Create Loan", "Set principal, interest rate, frequency and due date."],
    ["Track Interest", "Interest accrues automatically on the outstanding balance."],
    ["Collect Payment", "Record payments and allocate to interest and principal."],
    ["Monitor Outstanding", "Watch dues, overdue accounts and total exposure live."],
  ];
  const bars = [38, 55, 46, 70, 62, 84, 74, 92, 80, 96];

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 bg-surface/85 backdrop-blur-md border-b border-border">
        <div className="max-w-[1180px] mx-auto px-6 h-[70px] flex items-center gap-6">
          <Link href="#home" className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-primary to-purple flex items-center justify-center text-white font-extrabold shadow-[0_4px_12px_rgba(99,102,241,.35)]">L</span>
            <span className="font-extrabold text-lg leading-tight">
              LendPro
              <small className="block text-[10.5px] font-medium text-text-tertiary -mt-0.5">Money Lending Management</small>
            </span>
          </Link>
          <div className="hidden md:flex gap-6 ml-6">
            {[["#home", "Home"], ["#features", "Features"], ["#how", "How It Works"], ["#reports", "Reports"], ["#about", "About"]].map(([href, label]) => (
              <a key={href} href={href} className="font-medium text-text-secondary text-sm hover:text-text transition-colors">
                {label}
              </a>
            ))}
          </div>
          <div className="ml-auto flex gap-2.5 items-center">
            <Link href="/login" className="hidden sm:inline-flex px-4 py-2 rounded-[10px] text-[13.5px] font-semibold border border-border-strong hover:bg-surface-2 transition-colors">
              Admin Login
            </Link>
            <Link href="/signup" className="inline-flex px-4 py-2 rounded-[10px] text-[13.5px] font-semibold text-white bg-gradient-to-br from-primary to-primary-600 shadow-[0_2px_8px_rgba(99,102,241,.35)] hover:shadow-[0_6px_18px_rgba(99,102,241,.45)] transition-all">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <section id="home" className="max-w-[1180px] mx-auto px-6 py-16 lg:py-24 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-600 font-semibold text-[12.5px] px-3 py-1.5 rounded-full mb-5">
            <ShieldCheck className="w-4 h-4" /> Manage Loans. Track Interest. Collect Payments.
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] mb-5">
            Manage Your Money Lending Business{" "}
            <span className="bg-gradient-to-r from-primary to-purple bg-clip-text text-transparent">With Confidence</span>
          </h1>
          <p className="text-lg text-text-secondary leading-relaxed max-w-[520px] mx-auto lg:mx-0 mb-7">
            Track customers, loans, interest, payments, pending amounts and overdue collections from one professional dashboard.
          </p>
          <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
            <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-[15px] font-semibold text-white bg-gradient-to-br from-primary to-primary-600 shadow-[0_2px_8px_rgba(99,102,241,.35)] hover:shadow-[0_6px_18px_rgba(99,102,241,.45)] transition-all">
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#features" className="inline-flex items-center px-6 py-3.5 rounded-xl text-[15px] font-semibold border border-border-strong hover:bg-surface-2 transition-colors">
              Explore Features
            </a>
          </div>
          <div className="flex flex-wrap gap-7 justify-center lg:justify-start mt-10">
            {[["100%", "Dynamic calculations"], ["4", "Interest frequencies"], ["5", "Payment methods"], ["Live", "Overdue tracking"]].map(([n, l]) => (
              <div key={l}>
                <b className="block text-[22px] font-extrabold tracking-tight">{n}</b>
                <span className="text-[12.5px] text-text-secondary">{l}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative max-w-[560px] mx-auto w-full">
          <div className="bg-surface border border-border rounded-[20px] shadow-card-lg p-[18px]">
            <div className="flex gap-1.5 mb-3.5">
              <i className="w-2.5 h-2.5 rounded-full bg-red-400 block" />
              <i className="w-2.5 h-2.5 rounded-full bg-amber-400 block" />
              <i className="w-2.5 h-2.5 rounded-full bg-emerald-400 block" />
            </div>
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
                <i key={i} className="flex-1 rounded-t-[5px] rounded-b-sm bg-gradient-to-t from-primary to-purple opacity-85 block" style={{ height: `${h}%` }} />
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
        </div>
      </section>

      <section id="features" className="max-w-[1180px] mx-auto px-6 py-16 lg:py-20">
        <div className="text-center mb-11">
          <div className="text-primary font-bold text-[12.5px] uppercase tracking-widest mb-2.5">Features</div>
          <h2 className="text-[28px] sm:text-[34px] font-extrabold tracking-tight mb-3">Everything a lending business needs</h2>
          <p className="text-text-secondary text-[15.5px] max-w-[560px] mx-auto">Built for money lenders, chit operators and micro-finance desks who need accurate books without spreadsheets.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="bg-surface border border-border rounded-2xl p-6 hover:-translate-y-1 hover:shadow-card-lg hover:border-primary-200 transition-all duration-200">
              <div className={`w-12 h-12 rounded-[13px] flex items-center justify-center mb-[18px] ${f.cls}`}>
                <f.icon className="w-[22px] h-[22px]" />
              </div>
              <h3 className="text-[16.5px] font-bold mb-2">{f.title}</h3>
              <p className="text-text-secondary text-[13.5px] leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="max-w-[1180px] mx-auto px-6 py-16 lg:py-20 pt-0">
        <div className="text-center mb-11">
          <div className="text-primary font-bold text-[12.5px] uppercase tracking-widest mb-2.5">How It Works</div>
          <h2 className="text-[28px] sm:text-[34px] font-extrabold tracking-tight">From first loan to final payment in five steps</h2>
        </div>
        <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {steps.map(([title, text], i) => (
            <div key={title} className="text-center p-6 bg-surface border border-border rounded-2xl">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-purple text-white font-extrabold flex items-center justify-center mx-auto mb-3.5 text-[15px] shadow-[0_6px_16px_rgba(99,102,241,.35)]">
                {i + 1}
              </div>
              <h4 className="text-[14.5px] font-bold mb-1.5">{title}</h4>
              <p className="text-[12.5px] text-text-secondary leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="reports" className="max-w-[1180px] mx-auto px-6 py-16 lg:py-20 pt-0">
        <div className="bg-surface border border-border rounded-[22px] p-8 sm:p-10 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-primary font-bold text-[12.5px] uppercase tracking-widest mb-2.5">Reports &amp; Analytics</div>
            <h2 className="text-[26px] sm:text-[30px] font-extrabold tracking-tight mb-1">Know your numbers at a glance</h2>
            <ul className="flex flex-col gap-3 mt-5">
              {["Monthly lending, collections and interest trends", "Total outstanding, pending interest and overdue exposure", "Customer growth and loan status breakdown", "One-click CSV export and print-ready statements"].map((t) => (
                <li key={t} className="flex items-center gap-2.5 font-medium text-sm">
                  <CheckCircle2 className="w-[18px] h-[18px] text-success shrink-0" /> {t}
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
        </div>
      </section>

      <section id="about" className="max-w-[1180px] mx-auto px-6 py-16 lg:py-20 pt-0">
        <div className="bg-gradient-to-br from-primary-700 to-purple text-white rounded-[24px] p-10 sm:p-14 text-center">
          <h2 className="text-[26px] sm:text-[32px] font-extrabold tracking-tight mb-3.5">About LendPro</h2>
          <p className="max-w-[640px] mx-auto opacity-90 text-[15.5px] leading-relaxed mb-6">
            LendPro is a record-keeping and management tool for small and mid-size lending businesses. It replaces notebooks and spreadsheets with a dependable ledger that calculates interest, allocates payments and highlights what needs your attention today.
          </p>
          <Link href="/login" className="inline-flex px-6 py-3.5 rounded-xl text-[15px] font-semibold bg-white text-primary-700">
            Open Admin Dashboard
          </Link>
        </div>
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
