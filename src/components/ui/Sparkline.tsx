// A tiny inline trend line for KPI cards. Deliberately plain SVG, not a
// Chart.js instance — spinning up a full canvas chart for a 60x24px squiggle
// is wasted weight when four of these render on every dashboard load.
export function Sparkline({ data, tone = "primary", width = 64, height = 24 }: { data: number[]; tone?: "primary" | "success" | "danger" | "warning" | "info" | "purple"; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`);
  const stroke = { primary: "#4f46e5", success: "#16a34a", danger: "#dc2626", warning: "#d97706", info: "#0284c7", purple: "#8b5cf6" }[tone];
  const areaPath = `M0,${height} L${points.join(" L")} L${width},${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden>
      <path d={areaPath} fill={stroke} opacity={0.12} />
      <polyline points={points.join(" ")} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
