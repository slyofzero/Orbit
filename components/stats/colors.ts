import { M } from "@/lib/stats";

export type ColorBy = "acc" | "skip" | "speed" | "coverage";
export const COLOR_LABEL: Record<ColorBy, string> = { acc: "Accuracy", skip: "Skip rate", speed: "Speed", coverage: "Coverage" };

/** Tile colour as CSS custom properties; the stylesheet picks lightness per theme. Grey means "no data yet". */
export function tileColor(m: M, by: ColorBy, medianMs: number | null): { "--h": number; "--s": string } {
  const none = { "--h": 215, "--s": "8%" } as const;
  if (by === "acc") return m.acc === null ? none : { "--h": Math.round(m.acc * 125), "--s": m.answered < 3 ? "28%" : "68%" };
  if (by === "skip") return m.n === 0 ? none : { "--h": Math.round(125 - Math.min(m.skipRate / 0.5, 1) * 125), "--s": m.n < 3 ? "28%" : "68%" };
  if (by === "speed") {
    if (m.avgMs === null || !medianMs) return none;
    const r = Math.max(0.4, Math.min(2.2, m.avgMs / medianMs)); // 1 = typical
    return { "--h": Math.round(125 - ((r - 0.4) / 1.8) * 125), "--s": "62%" };
  }
  return m.total === 0 ? none : { "--h": 178, "--s": `${Math.round(8 + m.coverage * 62)}%` };
}

export function valueLabel(m: M, by: ColorBy): string {
  if (by === "acc") return m.acc === null ? "no data" : `${Math.round(m.acc * 100)}%`;
  if (by === "skip") return m.n === 0 ? "no data" : `${Math.round(m.skipRate * 100)}%`;
  if (by === "speed") return m.avgMs === null ? "no data" : m.avgMs < 60_000 ? `${Math.round(m.avgMs / 1000)}s` : `${Math.floor(m.avgMs / 60_000)}m${Math.round((m.avgMs % 60_000) / 1000)}s`;
  return `${Math.round(m.coverage * 100)}%`;
}

export const median = (xs: number[]) => { const s = xs.filter((x) => x > 0).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
