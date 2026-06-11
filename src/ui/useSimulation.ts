import { useEffect, useRef, useState } from 'react';
import { SimulationController, type SimSnapshot } from '../core/controller';
import { LPStrategy } from '../core/lp';
import { ThresholdStrategy } from '../core/threshold';
import type { Scenario } from '../core/types';
import { makeFleet } from './plant';

export const SPEEDS = [1, 6, 24] as const; // simulated hours per second
export type Speed = (typeof SPEEDS)[number];

export function useSimulation(scenario: Scenario | null) {
  const ctl = useRef<SimulationController | null>(null);
  const [snap, setSnap] = useState<SimSnapshot | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(6);
  const [epoch, setEpoch] = useState(0); // bumped on reset so charts can clear

  useEffect(() => {
    if (!scenario) return;
    ctl.current = new SimulationController(scenario, () => makeFleet(scenario.season), [
      new ThresholdStrategy(),
      new LPStrategy(),
    ]);
    setSnap(null);
    setPlaying(false);
    setEpoch((e) => e + 1);
  }, [scenario]);

  useEffect(() => {
    if (!playing || !scenario) return;
    const ticksPerSecond = speed * (60 / scenario.intervalMinutes);
    let acc = 0;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      acc += ((now - last) / 1000) * ticksPerSecond;
      last = now;
      let latest: SimSnapshot | null = null;
      while (acc >= 1) {
        acc -= 1;
        const s = ctl.current?.tick() ?? null;
        if (!s) { setPlaying(false); break; }
        latest = s;
      }
      if (latest) setSnap(latest);
    }, 50);
    return () => clearInterval(id);
  }, [playing, speed, scenario, epoch]);

  const reset = () => {
    if (!scenario) return;
    ctl.current = new SimulationController(scenario, () => makeFleet(scenario.season), [
      new ThresholdStrategy(),
      new LPStrategy(),
    ]);
    setSnap(null);
    setPlaying(false);
    setEpoch((e) => e + 1);
  };

  return { snap, playing, setPlaying, speed, setSpeed, reset, epoch };
}
