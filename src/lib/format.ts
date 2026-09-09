export function formatCurrency(amount: number | null | undefined, decimals = 0): string {
  const n = Number(amount) || 0;
  const body = Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (n < 0 ? "-₹" : "₹") + body;
}

export function formatNumber(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString("en-IN");
}

export function compactINR(v: number): string {
  v = Number(v) || 0;
  const abs = Math.abs(v);
  if (abs >= 1e7) return (v / 1e7).toFixed(1) + "Cr";
  if (abs >= 1e5) return (v / 1e5).toFixed(1) + "L";
  if (abs >= 1e3) return (v / 1e3).toFixed(0) + "K";
  return String(v);
}

export function initials(name: string | null | undefined): string {
  return (
    String(name || "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

const AVATAR_PALETTES = [
  ["#6366f1", "#8b5cf6"],
  ["#0ea5e9", "#6366f1"],
  ["#10b981", "#0ea5e9"],
  ["#f59e0b", "#ef4444"],
  ["#ec4899", "#8b5cf6"],
  ["#14b8a6", "#10b981"],
  ["#f97316", "#f59e0b"],
];

export function avatarGradient(seed: string): string {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [a, b] = AVATAR_PALETTES[h % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}
