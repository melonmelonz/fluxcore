import { useEffect, useRef, useState } from 'react';
import { Backtest, type BacktestResult } from '../../core/backtest';
import { LPStrategy } from '../../core/lp';
import { oraclePnl } from '../../core/oracle';
import { seasonForMonth } from '../../core/solar';
import { ThresholdStrategy } from '../../core/threshold';
import type { PricePoint, Scenario } from '../../core/types';
import { type FleetMix, fleetFromMix, mixTotals } from '../../core/units';
import { MAX_LAB_DAYS, monthsInRange, rangeDays, rangeMs } from './range';
import type { LabParams } from './share';

export interface ArchiveIndex { hubs: string[]; months: string[] }
export interface LabRun {
  params: LabParams;
  results: BacktestResult[];
  oracle: number;
  points: number;
}

export async function loadRange(params: LabParams): Promise<{ rtm: PricePoint[]; dam: PricePoint[] }> {
  const months = monthsInRange(params.start, params.end);
  const chunks = await Promise.all(months.map(async (m) => {
    const r = await fetch(`/data/archive/${params.hub}/${m}.json`);
    if (!r.ok) throw new Error(`no archive for ${params.hub} ${m}`);
    return r.json() as Promise<{ rtm: PricePoint[]; dam: PricePoint[] }>;
  }));
  const { lo, hi } = rangeMs(params.start, params.end);
  const inWin = (p: PricePoint) => p.t >= lo && p.t < hi;
  return {
    rtm: chunks.flatMap((c) => c.rtm).filter(inWin),
    dam: chunks.flatMap((c) => c.dam).filter(inWin),
  };
}

export function useLab() {
  const [index, setIndex] = useState<ArchiveIndex | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [run, setRun] = useState<LabRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    fetch('/data/archive/index.json')
      .then((r) => r.json())
      .then(setIndex)
      .catch(() => setError('failed to load archive index'));
  }, []);

  async function start(params: LabParams, mix: FleetMix) {
    const id = ++seq.current;
    setRunning(true);
    setError(null);
    setRun(null);
    setProgress(0);
    try {
      if (rangeDays(params.start, params.end) > MAX_LAB_DAYS) {
        throw new Error(`range too long - max ${MAX_LAB_DAYS} days per run`);
      }
      const { rtm, dam } = await loadRange(params);
      if (rtm.length === 0) throw new Error('no data in that window');
      const season = seasonForMonth(Number(params.start.slice(5, 7)));
      const scenario: Scenario = {
        id: 'lab', name: 'lab', description: '', season, intervalMinutes: 15, rtm, dam,
      };
      const bt = new Backtest(scenario, () => fleetFromMix(mix, season), [
        new ThresholdStrategy(),
        new LPStrategy(),
      ]);
      while (!bt.step(192)) {
        if (seq.current !== id) return; // superseded
        setProgress(bt.progress);
        await new Promise((r) => setTimeout(r, 0)); // yield to the UI
      }
      const probe = fleetFromMix(mix, season).view();
      const t = mixTotals(mix);
      const oracle = oraclePnl(rtm, {
        capacityKWh: t.capacityKWh,
        maxChargeKW: probe.maxChargeKW,
        maxDischargeKW: t.maxDischargeKW,
        roundTripEfficiency: probe.roundTripEfficiency,
        degradationCostPerMWh: probe.degradationCostPerMWh,
        solarPeakKW: t.solarPeakKW,
      }, season, 15);
      if (seq.current !== id) return;
      setRun({ params, results: bt.results(), oracle, points: rtm.length });
    } catch (e) {
      if (seq.current === id) setError(e instanceof Error ? e.message : 'backtest failed');
    } finally {
      if (seq.current === id) { setRunning(false); setProgress(1); }
    }
  }

  return { index, running, progress, run, error, start };
}
