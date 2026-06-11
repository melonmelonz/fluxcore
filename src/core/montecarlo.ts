import { Backtest } from './backtest';
import type { Fleet } from './fleet';
import type { Strategy } from './strategy';
import type { PricePoint, Scenario } from './types';

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

export interface MonteCarloOptions {
  /** perturbed runs in addition to the unperturbed baseline (run 0) */
  runs: number;
  sigma: number;
  seed: number;
  /** fresh strategy instances per run (strategies may hold state) */
  strategyFactory: () => Strategy[];
}

export interface StrategyDistribution {
  name: string;
  /** index 0 = unperturbed baseline */
  pnls: number[];
  stats: DistStats;
  bins: HistBin[];
}

export class MonteCarlo {
  private readonly rand: () => number;
  private runIdx = 0;
  private current: Backtest | null = null;
  private names: string[] = [];
  private readonly collected: number[][] = [];

  constructor(
    private readonly scenario: Scenario,
    private readonly fleetFactory: () => Fleet,
    private readonly opts: MonteCarloOptions,
  ) {
    this.rand = mulberry32(opts.seed);
  }

  get totalRuns(): number {
    return this.opts.runs + 1;
  }

  get progress(): number {
    const inner = this.current?.progress ?? 0;
    return Math.min(1, (this.runIdx + inner) / this.totalRuns);
  }

  /** Step up to n engine ticks; true when every run is complete. */
  step(n: number): boolean {
    if (this.runIdx >= this.totalRuns) return true;
    if (!this.current) {
      const dam = this.runIdx === 0
        ? this.scenario.dam
        : perturbDam(this.scenario.dam, this.opts.sigma, this.rand);
      this.current = new Backtest({ ...this.scenario, dam }, this.fleetFactory, this.opts.strategyFactory());
    }
    if (this.current.step(n)) {
      const results = this.current.results();
      if (this.runIdx === 0) {
        this.names = results.map((r) => r.name);
        results.forEach(() => this.collected.push([]));
      }
      results.forEach((r, i) => this.collected[i].push(r.pnl));
      this.current = null;
      this.runIdx += 1;
    }
    return this.runIdx >= this.totalRuns;
  }

  /** Distributions over completed runs (callable mid-flight for streaming UI). */
  results(): StrategyDistribution[] {
    return this.names.map((name, i) => {
      const pnls = this.collected[i];
      return { name, pnls, stats: summarize(pnls), bins: histogram(pnls, 12) };
    });
  }
}
