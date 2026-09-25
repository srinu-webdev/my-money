"use client";

import { toast } from "@/lib/toast";

export function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  if (!rows.length) {
    toast.warning("Nothing to export");
    return;
  }
  const escapeCell = (v: string | number) => {
    let s = v === null || v === undefined ? "" : String(v);
    // CSV/formula injection guard: a cell starting with =, +, -, or @ can
    // execute as a formula when the file is opened in Excel/Sheets. A
    // leading apostrophe forces spreadsheet apps to treat it as literal
    // text without changing what a plain CSV reader sees.
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + [headers.map(escapeCell).join(","), ...rows.map((r) => r.map(escapeCell).join(","))].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast.success(`Exported ${rows.length} rows to ${filename}`);
}
