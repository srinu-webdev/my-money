"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
  type Chart,
  type TooltipModel,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { compactINR, formatCurrency } from "@/lib/format";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

export function useChartColors() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // Standard SSR-hydration guard: next-themes' resolvedTheme is unknown on
  // the server, so the first client render must match the server's output
  // before switching to the real theme colors on the next tick.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return {
    text: dark ? "#a4aabb" : "#6b7280",
    grid: dark ? "rgba(255,255,255,.06)" : "rgba(17,24,39,.06)",
    tooltipBg: dark ? "#1c2030" : "#111827",
    primary: "#6366f1",
    purple: "#8b5cf6",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#0ea5e9",
  };
}

// Escapes text before it's interpolated into the tooltip's HTML string below.
// Every caller today only passes fixed, hardcoded labels, so this is a no-op
// in practice — it's just a safety net against a future free-text label
// turning `box.innerHTML = html` into an XSS sink.
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Chart.js's own canvas-drawn tooltip is supposed to flip sides when there's
// no room, but a point right at the chart's edge (e.g. the last month on a
// line chart) doesn't reliably trigger that flip — the box gets clipped by
// the canvas boundary instead of just repositioning. Rendering the tooltip
// as a real positioned HTML element instead (Chart.js still computes the
// title/body text via the normal `callbacks`, this just draws it) lets its
// left position be clamped to the chart's own width, so it can never run
// off either edge no matter which point is hovered.
function externalTooltip(c: ReturnType<typeof useChartColors>) {
  return (ctx: { chart: Chart; tooltip: TooltipModel<"line" | "bar" | "doughnut"> }) => {
    const { chart, tooltip } = ctx;
    const parent = chart.canvas.parentNode;
    if (!(parent instanceof HTMLElement)) return;
    if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
    let box = parent.querySelector<HTMLDivElement>(":scope > .cjs-tooltip");
    if (!box) {
      box = document.createElement("div");
      box.className = "cjs-tooltip";
      Object.assign(box.style, {
        position: "absolute",
        pointerEvents: "none",
        zIndex: "30",
        borderRadius: "10px",
        padding: "8px 11px",
        fontFamily: "Inter, sans-serif",
        fontSize: "12.5px",
        lineHeight: "1.6",
        color: "#fff",
        whiteSpace: "nowrap",
        boxShadow: "0 8px 24px rgba(0,0,0,.18)",
        top: "0",
        left: "0",
      } satisfies Partial<CSSStyleDeclaration>);
      parent.appendChild(box);
    }
    if (tooltip.opacity === 0) {
      box.style.opacity = "0";
      return;
    }
    box.style.backgroundColor = c.tooltipBg;

    let html = "";
    if (tooltip.title?.length) html += `<div style="font-weight:600;margin-bottom:2px">${escapeHtml(tooltip.title.join(" "))}</div>`;
    tooltip.body.forEach((b: { lines: string[] }, i: number) => {
      // tooltip.labelColors[i].backgroundColor can be a live CanvasGradient
      // object (the line charts' area-fill), not a CSS-usable string — pull
      // the plain hex straight from the dataset instead (borderColor is the
      // line/bar's own solid color; backgroundColor is the fallback for bar
      // charts, which may itself be an array of per-point colors).
      const point = tooltip.dataPoints?.[i];
      const dataset = point ? chart.data.datasets[point.datasetIndex] : undefined;
      const pick = (v: unknown): string | undefined => (typeof v === "string" ? v : Array.isArray(v) && typeof v[point!.dataIndex] === "string" ? v[point!.dataIndex] : undefined);
      const color = dataset ? (pick(dataset.borderColor) ?? pick(dataset.backgroundColor)) : undefined;
      const swatch = color ? `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:6px"></span>` : "";
      b.lines.forEach((line: string) => {
        html += `<div style="display:flex;align-items:center">${swatch}${escapeHtml(line)}</div>`;
      });
    });
    box.innerHTML = html;

    const boxWidth = box.offsetWidth;
    const boxHeight = box.offsetHeight;
    const margin = 6;
    let left = tooltip.caretX + 12;
    if (left + boxWidth > chart.width - margin) left = tooltip.caretX - boxWidth - 12;
    left = Math.max(margin, Math.min(left, chart.width - boxWidth - margin));
    let top = tooltip.caretY - boxHeight / 2;
    top = Math.max(margin, Math.min(top, chart.height - boxHeight - margin));

    box.style.transform = `translate(${left}px, ${top}px)`;
    box.style.opacity = "1";
  };
}

// Deliberately untyped return (rather than ChartOptions<"bar" | "line">):
// Chart.js's per-type option interfaces are structurally close but not
// assignable to each other once scriptable callbacks are involved, so a
// shared union-typed builder can't satisfy every call site's specific
// <Bar>/<Line> `options` prop. Each call site casts to the type it needs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function baseOptions(c: ReturnType<typeof useChartColors>, count?: boolean): any {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    layout: { padding: { top: 8, right: 4, bottom: 0, left: 4 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: externalTooltip(c),
        callbacks: { label: (ctx: { formattedValue: string; parsed: { y: number } }) => " " + (count ? ctx.formattedValue : formatCurrency(ctx.parsed.y)) },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: c.text, font: { family: "Inter", size: 11 } }, border: { display: false } },
      // `grace` pads the auto-computed max above the highest data point —
      // without it the y-axis max lands exactly AT the peak, and a smoothed
      // line (tension > 0) can overshoot its own data point at the curve's
      // apex, clipping flat against the chart's top edge instead of curving
      // naturally. 12% headroom gives the curve room to round off cleanly.
      y: { grid: { color: c.grid }, border: { display: false }, grace: "12%", ticks: { color: c.text, font: { family: "Inter", size: 11 }, callback: (v: number | string) => (count ? v : compactINR(Number(v))) } },
    },
  };
}

export function MoneyBarChart({ labels, data, color = "primary" }: { labels: string[]; data: number[]; color?: "primary" | "purple" | "success" | "info" }) {
  const c = useChartColors();
  return (
    <Bar
      data={{ labels, datasets: [{ data, backgroundColor: c[color], borderRadius: 6, maxBarThickness: 34 }] }}
      options={baseOptions(c)}
    />
  );
}

export function MoneyLineChart({ labels, data, color = "success" }: { labels: string[]; data: number[]; color?: "primary" | "purple" | "success" | "info" }) {
  const c = useChartColors();
  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            data,
            borderColor: c[color],
            backgroundColor: (ctx) => {
              const { chart } = ctx;
              const { ctx: canvasCtx, chartArea } = chart;
              if (!chartArea) return c[color] + "22";
              const g = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              g.addColorStop(0, c[color] + "55");
              g.addColorStop(1, c[color] + "05");
              return g;
            },
            fill: true,
            tension: 0.38,
            borderWidth: 2.5,
            pointRadius: 3,
            pointBackgroundColor: c[color],
            pointBorderColor: "#fff",
          },
        ],
      }}
      options={baseOptions(c)}
    />
  );
}

export function CountBarChart({ labels, data, color = "info" }: { labels: string[]; data: number[]; color?: "primary" | "purple" | "success" | "info" }) {
  const c = useChartColors();
  return <Bar data={{ labels, datasets: [{ data, backgroundColor: c[color], borderRadius: 6, maxBarThickness: 28 }] }} options={baseOptions(c, true)} />;
}

// Two money series side-by-side per month (not stacked — Money Lent and
// Interest Collected aren't parts of one whole, they're separate figures
// worth comparing month to month).
export function GroupedMoneyBarChart({
  labels,
  series,
}: {
  labels: string[];
  series: { label: string; data: number[]; color: "primary" | "purple" | "success" | "info" | "warning" | "danger" }[];
}) {
  const c = useChartColors();
  const opts = baseOptions(c) as ChartOptions<"bar">;
  return (
    <Bar
      data={{ labels, datasets: series.map((s) => ({ label: s.label, data: s.data, backgroundColor: c[s.color], borderRadius: 6, maxBarThickness: 22 })) }}
      options={{
        ...opts,
        plugins: {
          ...opts.plugins,
          legend: { display: true, position: "top", align: "end", labels: { color: c.text, boxWidth: 10, usePointStyle: true, font: { family: "Inter", size: 11.5 } } },
        },
      }}
    />
  );
}

// Several money series over time on one chart, each with its own soft area
// fill under a smooth line — used for Portfolio Performance (money
// disbursed / collections / interest collected side by side per month).
export function MultiLineChart({
  labels,
  series,
}: {
  labels: string[];
  series: { label: string; data: number[]; color: "primary" | "purple" | "success" | "info" | "warning" | "danger" }[];
}) {
  const c = useChartColors();
  const opts = baseOptions(c) as ChartOptions<"line">;
  return (
    <Line
      data={{
        labels,
        datasets: series.map((s) => {
          const hex = c[s.color];
          return {
            label: s.label,
            data: s.data,
            borderColor: hex,
            backgroundColor: (ctx: { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } }) => {
              const { chart } = ctx;
              const { ctx: canvasCtx, chartArea } = chart;
              if (!chartArea) return hex + "22";
              const g = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              g.addColorStop(0, hex + "40");
              g.addColorStop(1, hex + "02");
              return g;
            },
            fill: true,
            tension: 0.35,
            borderWidth: 2.25,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: hex,
            pointHoverBorderColor: "#fff",
            pointHoverBorderWidth: 2,
          };
        }),
      }}
      options={{
        ...opts,
        plugins: {
          ...opts.plugins,
          legend: { display: true, position: "top", align: "end", labels: { color: c.text, boxWidth: 10, usePointStyle: true, font: { family: "Inter", size: 11.5 } } },
          tooltip: { ...opts.plugins!.tooltip, callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` } },
        },
      }}
    />
  );
}

// Net cash flow per month — green bars for a net inflow, red for a net
// outflow, colored per-datapoint rather than per-series since the sign
// flips month to month.
export function CashFlowBarChart({ labels, data }: { labels: string[]; data: number[] }) {
  const c = useChartColors();
  const opts = baseOptions(c) as ChartOptions<"bar">;
  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            data,
            backgroundColor: data.map((v) => (v >= 0 ? c.success : c.danger)),
            borderRadius: 6,
            maxBarThickness: 28,
          },
        ],
      }}
      options={{
        ...opts,
        plugins: {
          ...opts.plugins,
          tooltip: {
            ...opts.plugins!.tooltip,
            callbacks: {
              label: (ctx) => {
                const y = ctx.parsed.y ?? 0;
                return ` ${y >= 0 ? "Net inflow" : "Net outflow"}: ${formatCurrency(Math.abs(y))}`;
              },
            },
          },
        },
      }}
    />
  );
}

export function StackedMoneyBarChart({ labels, series }: { labels: string[]; series: { label: string; data: number[]; color: string }[] }) {
  const c = useChartColors();
  const opts = baseOptions(c) as ChartOptions<"bar">;
  return (
    <Bar
      data={{ labels, datasets: series.map((s) => ({ label: s.label, data: s.data, backgroundColor: s.color, borderRadius: 4, maxBarThickness: 30 })) }}
      options={{
        ...opts,
        plugins: { ...opts.plugins, legend: { display: true, labels: { color: c.text, boxWidth: 10, usePointStyle: true, font: { family: "Inter", size: 11 } } } },
        scales: { x: { ...opts.scales!.x, stacked: true }, y: { ...opts.scales!.y, stacked: true } },
      }}
    />
  );
}

// No built-in Chart.js legend here — the caller (LoanPortfolio) renders its
// own HTML legend next to a dedicated square canvas box instead, so the
// "N Total Loans" center overlay can sit at that box's exact center on any
// screen size, rather than guessing how much width Chart.js's own legend
// would take up.
export function LoanStatusDoughnut({ labels, data }: { labels: string[]; data: number[] }) {
  const c = useChartColors();
  return (
    <Doughnut
      data={{ labels, datasets: [{ data, backgroundColor: [c.primary, c.info, c.success, c.danger], borderWidth: 0, hoverOffset: 6 }] }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false, external: externalTooltip(c), callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.formattedValue} loans` } },
        },
      }}
    />
  );
}
