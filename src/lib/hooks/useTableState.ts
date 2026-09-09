"use client";

import { useMemo, useState } from "react";

export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize]);
  return {
    page: safePage,
    setPage: (p: number) => setPage(Math.max(1, p)),
    totalPages,
    pageItems,
    total: items.length,
    startIdx: items.length ? start + 1 : 0,
    endIdx: Math.min(items.length, start + pageSize),
  };
}

export function useSort<T>(items: T[], defaultField: string, getValue: (item: T, field: string) => string | number, defaultDir: "asc" | "desc" = "desc") {
  const [field, setField] = useState(defaultField);
  const [dir, setDir] = useState<"asc" | "desc">(defaultDir);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      let av = getValue(a, field);
      let bv = getValue(b, field);
      if (typeof av === "string") {
        av = av.toLowerCase();
        bv = String(bv).toLowerCase();
      }
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
    // `getValue` is intentionally omitted: every call site passes a fresh
    // inline arrow function, so including it would defeat the memo (it
    // would never be referentially stable) without changing what gets sorted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, field, dir]);

  function toggle(nextField: string, ascFirst = false) {
    if (field === nextField) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setField(nextField);
      setDir(ascFirst ? "asc" : "desc");
    }
  }

  return { sorted, field, dir, toggle };
}

export function useSelection<T extends string>() {
  const [selected, setSelected] = useState<Set<T>>(new Set());
  function toggle(id: T) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll(ids: T[], checked: boolean) {
    setSelected((s) => {
      const next = new Set(s);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  }
  function clear() {
    setSelected(new Set());
  }
  return { selected, toggle, toggleAll, clear };
}
