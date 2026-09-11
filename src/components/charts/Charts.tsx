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
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { compactINR, formatCurrency } from "@/lib/format";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

function useChartColors() {
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
    // Chart.js draws the tooltip inside the canvas itself — near the right
    // edge (e.g. hovering the last month on a line chart) there isn't
    // always room to flip it fully into view, so it gets clipped by the
    // canvas boundary instead of just repositioning. A little breathing
    // room on the right (and top, since a tall tooltip can also clip
    // upward) gives it somewhere to render without being cut off.
    layout: { padding: { top: 8, right: 14, bottom: 0, left: 4 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: c.tooltipBg,
        padding: 10,
        titleFont: { family: "Inter", weight: 600 },
        bodyFont: { family: "Inter" },
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
          legend: { position: "right", labels: { color: c.text, usePointStyle: true, boxWidth: 8, font: { family: "Inter", size: 11.5 }, padding: 14 } },
          tooltip: { backgroundColor: c.tooltipBg, callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.formattedValue} loans` } },
        },
      }}
    />
  );
}
