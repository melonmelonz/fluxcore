import type { PricePoint } from '../../src/core/types';

export function mergePoints(
  existing: PricePoint[], incoming: PricePoint[], now: number, maxAgeMs: number,
): PricePoint[] {
  const byT = new Map<number, number>();
  for (const pt of existing) byT.set(pt.t, pt.price);
  for (const pt of incoming) byT.set(pt.t, pt.price);
  return [...byT.entries()]
    .map(([t, price]) => ({ t, price }))
    .filter((pt) => pt.t >= now - maxAgeMs)
    .sort((a, b) => a.t - b.t);
}
