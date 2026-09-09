"use client";

import { toast } from "@/lib/toast";
import { getReceiptContextAction } from "@/lib/actions/options";
import { formatCurrency } from "@/lib/format";
import { formatDate } from "@/lib/dates";
import type { Payment } from "@/lib/types";

export async function printReceipt(payment: Payment) {
  const ctx = await getReceiptContextAction(payment.id);
  if (!ctx) return toast.error("Could not load receipt details");
  const w = window.open("", "_blank", "width=720,height=800");
  if (!w) return toast.warning("Pop-up blocked — allow pop-ups to print receipts");
  const { settings, customerName, outstandingAfter } = ctx;
  const rows = [
    ["Customer", customerName],
    ["Loan", payment.loanId],
    ["Date", formatDate(payment.paymentDate)],
    ["Method", payment.paymentMethod + (payment.reference ? ` · ${payment.reference}` : "")],
    ["Interest portion", formatCurrency(payment.interestAmount)],
    ["Principal portion", formatCurrency(payment.principalAmount)],
    ...(outstandingAfter !== null ? [["Balance after all payments", formatCurrency(outstandingAfter)]] : []),
  ];
  w.document.write(`<!doctype html><html><head><title>Receipt ${payment.id}</title><meta charset="utf-8"><style>
    body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#111}
    h1{font-size:20px;margin:0}
    table{width:100%;border-collapse:collapse;margin-top:18px}
    td{padding:8px 0;border-bottom:1px solid #eee}
    td:last-child{text-align:right;font-weight:600}
    .muted{color:#666;font-size:12px}
    .tot{font-size:22px;font-weight:800;margin-top:14px}
  </style></head><body>
    <h1>${escapeHtml(settings.businessName)}</h1>
    <div class="muted">${escapeHtml(settings.businessAddress)} · ${escapeHtml(settings.businessPhone)}</div>
    <h2 style="margin-top:24px;font-size:16px">Payment Receipt · ${payment.id}</h2>
    <table>${rows.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join("")}</table>
    <div class="tot">Amount received: ${formatCurrency(payment.amount)}</div>
    <p class="muted" style="margin-top:28px">Recorded by ${escapeHtml(payment.recordedBy)} · This is a computer generated receipt.</p>
    <script>window.onload=function(){window.print()}<\/script>
  </body></html>`);
  w.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]!);
}
