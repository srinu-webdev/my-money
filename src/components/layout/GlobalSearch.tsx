"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, User, CreditCard, Wallet } from "lucide-react";
import { globalSearchAction, type SearchResult } from "@/lib/actions/search";

const ICON = { customer: User, loan: CreditCard, payment: Wallet } as const;
const ROUTE = { customer: "/customers", loan: "/loans", payment: "/payments" } as const;

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.getElementById("global-search-input") as HTMLInputElement | null;
        el?.focus();
        el?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function onChange(v: string) {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!v.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const r = await globalSearchAction(v);
      setResults(r);
      setOpen(true);
    }, 220);
  }

  function go(r: SearchResult) {
    setOpen(false);
    setQuery("");
    router.push(r.kind === "customer" ? `${ROUTE.customer}/${r.id}` : r.kind === "loan" ? `${ROUTE.loan}/${r.id}` : `${ROUTE.payment}`);
  }

  const groups: { kind: SearchResult["kind"]; label: string }[] = [
    { kind: "customer", label: "Customers" },
    { kind: "loan", label: "Loans" },
    { kind: "payment", label: "Payments" },
  ];

  return (
    <div className="relative flex-1 max-w-[460px]" ref={boxRef}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
      <input
        id="global-search-input"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => query && setOpen(true)}
        placeholder="Search customers, loans, payments…"
        autoComplete="off"
        className="w-full pl-9 pr-14 py-2.5 rounded-[10px] bg-surface-2 border border-transparent text-[13.5px] outline-none focus:bg-surface focus:border-primary transition-colors"
      />
      <kbd className="hidden sm:block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10.5px] text-text-tertiary border border-border rounded px-1.5 py-0.5 bg-surface font-sans">Ctrl K</kbd>
      {open && (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-surface border border-border rounded-2xl shadow-card-lg p-2 z-[200] max-h-[420px] overflow-y-auto">
          {results.length === 0 ? (
            <div className="text-center py-6 text-text-secondary text-sm">No results for &ldquo;{query}&rdquo;</div>
          ) : (
            groups.map((g) => {
              const items = results.filter((r) => r.kind === g.kind);
              if (!items.length) return null;
              return (
                <div key={g.kind}>
                  <div className="text-[10.5px] uppercase tracking-wide font-bold text-text-tertiary px-2.5 pt-2 pb-1">{g.label}</div>
                  {items.map((r) => {
                    const Icon = ICON[r.kind];
                    return (
                      <button key={r.id} onClick={() => go(r)} className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-[10px] hover:bg-surface-3 transition-colors text-left">
                        <span className="w-8 h-8 rounded-[9px] bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                          <Icon className="w-[15px] h-[15px]" />
                        </span>
                        <span className="min-w-0">
                          <div className="font-semibold text-[13px] truncate">{r.title}</div>
                          <div className="text-[11.5px] text-text-tertiary truncate">{r.sub}</div>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
