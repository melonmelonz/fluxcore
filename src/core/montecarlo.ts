import type { PricePoint } from './types';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draw via Box-Muller. */
export function normal(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Multiplicative forecast noise: price * (1 + sigma * z). Timestamps preserved. */
export function perturbDam(dam: PricePoint[], sigma: number, rand: () => number): PricePoint[] {
  if (sigma === 0) return dam.map((p) => ({ ...p }));
  return dam.map((p) => ({ t: p.t, price: p.price * (1 + sigma * normal(rand)) }));
}

export interface DistStats { min: number; p5: number; median: number; p95: number; max: number; mean: number }

export function summarize(pnls: number[]): DistStats {
  const s = [...pnls].sort((a, b) => a - b);
  const q = (p: number) => s[Math.round(p * (s.length - 1))];
  return {
    min: s[0], p5: q(0.05), median: q(0.5), p95: q(0.95), max: s[s.length - 1],
    mean: s.reduce((a, b) => a + b, 0) / s.length,
  };
}

export interface HistBin { x0: number; x1: number; count: number }

export function histogram(values: number[], bins: number): HistBin[] {
  const min = Math.min(...values), max = Math.max(...values);
  const w = (max - min) / bins || 1;
  const out: HistBin[] = Array.from({ length: bins }, (_, i) =>
    ({ x0: min + i * w, x1: min + (i + 1) * w, count: 0 }));
  for (const v of values) out[Math.min(bins - 1, Math.floor((v - min) / w))].count += 1;
  return out;
}
