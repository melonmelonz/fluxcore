import { useRef, useState } from 'react';
import { MonteCarlo, type StrategyDistribution } from '../../core/montecarlo';
import { LPStrategy } from '../../core/lp';
import { ThresholdStrategy } from '../../core/threshold';
import { seasonForMonth } from '../../core/solar';
import { type FleetMix, fleetFromMix } from '../../core/units';
import type { Scenario } from '../../core/types';
import { loadRange } from './useLab';
import type { LabParams } from './share';

export interface StressResult { dists: StrategyDistribution[]; runsDone: number; total: number }

export function useStress() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<StressResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  async function start(params: LabParams, mix: FleetMix, runs: number, sigma: number) {
    const id = ++seq.current;
    setRunning(true); setError(null); setResult(null); setProgress(0);
    try {
      const { rtm, dam } = await loadRange(params);
      const season = seasonForMonth(Number(params.start.slice(5, 7)));
      const scenario: Scenario = { id: 'stress', name: 'stress', description: '', season, intervalMinutes: 15, rtm, dam };
      const mc = new MonteCarlo(scenario, () => fleetFromMix(mix, season), {
        runs, sigma, seed: 20260611,
        strategyFactory: () => [new ThresholdStrategy(), new LPStrategy()],
      });
      let done = false;
      while (!done) {
        done = mc.step(192);
        if (seq.current !== id) return; // superseded
        setProgress(mc.progress);
        setResult({ dists: mc.results(), runsDone: mc.runsDone, total: runs + 1 });
        await new Promise((r) => setTimeout(r, 0)); // yield to the UI
      }
    } catch (e) {
      if (seq.current === id) setError(e instanceof Error ? e.message : 'stress run failed');
    } finally {
      if (seq.current === id) { setRunning(false); setProgress(1); }
    }
  }

  return { running, progress, result, error, start };
}
