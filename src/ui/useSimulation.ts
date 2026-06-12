import { useEffect, useState } from 'react';
import { SimulationController, type SimSnapshot } from '../core/controller';
import { LPStrategy } from '../core/lp';
import { ThresholdStrategy } from '../core/threshold';
import type { Scenario } from '../core/types';
import type { FleetMix } from '../core/units';
import { makeFleet } from './plant';

export const SPEEDS = [1, 6, 24] as const; // simulated hours per second
export type Speed = (typeof SPEEDS)[number];

function makeController(scenario: Scenario, mix: FleetMix): SimulationController {
  return new SimulationController(scenario, () => makeFleet(scenario.season, mix), [
    new ThresholdStrategy(),
    new LPStrategy(),
  ]);
}

export function useSimulation(scenario: Scenario | null, mix: FleetMix) {
  const [ctl, setCtl] = useState<SimulationController | null>(null);
  const [snap, setSnap] = useState<SimSnapshot | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(6);
  const [epoch, setEpoch] = useState(0); // bumped on reset so charts can clear
  const [prevScenario, setPrevScenario] = useState<Scenario | null>(null);
  const [prevMixKey, setPrevMixKey] = useState('');
  const mixKey = JSON.stringify(mix);

  // reset derived state when the scenario or mix changes (render-time adjustment,
  // see react.dev "you might not need an effect")
  if (scenario !== prevScenario || mixKey !== prevMixKey) {
    setPrevScenario(scenario);
    setPrevMixKey(mixKey);
    setCtl(scenario ? makeController(scenario, mix) : null);
    setSnap(null);
    setPlaying(false);
    setEpoch((e) => e + 1);
  }

  useEffect(() => {
    if (!playing || !scenario || !ctl) return;
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
        const s = ctl.tick();
        if (!s) { setPlaying(false); break; }
        latest = s;
      }
      if (latest) setSnap(latest);
    }, 50);
    return () => clearInterval(id);
  }, [playing, speed, scenario, ctl]);

  const reset = () => {
    if (!scenario) return;
    setCtl(makeController(scenario, mix));
    setSnap(null);
    setPlaying(false);
    setEpoch((e) => e + 1);
  };

  /** Single-tick scrub. Forward advances the live controller; backward replays a
   *  fresh controller to tick N-1 (deterministic core makes this exact) and bumps
   *  the epoch so the chart re-seeds instead of receiving an out-of-order update.
   *  The current tick index is derived from the snapshot's position in the price
   *  series, so no extra counter state is needed. */
  const step = (dir: 1 | -1) => {
    if (!scenario || !ctl) return;
    setPlaying(false);
    if (dir === 1) {
      const s = ctl.tick();
      if (s) setSnap(s);
      return;
    }
    const count = snap ? scenario.rtm.findIndex((p) => p.t === snap.t) + 1 : 0;
    const target = count - 1;
    if (target < 0) return;
    const fresh = makeController(scenario, mix);
    let s: SimSnapshot | null = null;
    for (let i = 0; i < target; i++) s = fresh.tick();
    setCtl(fresh);
    setSnap(s);
    setEpoch((e) => e + 1);
  };

  return { snap, playing, setPlaying, speed, setSpeed, reset, step, epoch, exportEntries: () => ctl?.ledgers().flatMap((g) => g.entries).sort((a, b) => a.t - b.t) ?? [] };
}
