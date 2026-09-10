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

// Flat initial-avatar colours: a soft tint with a darker ink of the same
// hue (the Google-Contacts convention), chosen deterministically per name
// so a customer keeps the same colour everywhere they appear.
const AVATAR_COLORS: { bg: string; fg: string }[] = [
  { bg: "#e0e7ff", fg: "#3730a3" },
  { bg: "#dbeafe", fg: "#1e40af" },
  { bg: "#d1fae5", fg: "#065f46" },
  { bg: "#fef3c7", fg: "#92400e" },
  { bg: "#fce7f3", fg: "#9d174d" },
  { bg: "#ccfbf1", fg: "#115e59" },
  { bg: "#ffedd5", fg: "#9a3412" },
  { bg: "#ede9fe", fg: "#5b21b6" },
];

export function avatarStyle(seed: string): { backgroundColor: string; color: string } {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const { bg, fg } = AVATAR_COLORS[h % AVATAR_COLORS.length];
  return { backgroundColor: bg, color: fg };
}
