import { useState } from 'react';
import type { StrategyDistribution } from '../../core/montecarlo';
import type { FleetMix } from '../../core/units';
import type { LabParams } from './share';
import { useStress } from './useStress';

const usd = (n: number) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Distribution({ dist, oracle }: { dist: StrategyDistribution; oracle: number }) {
  const peak = Math.max(...dist.bins.map((b) => b.count), 1);
  return (
    <div className="dist">
      <div className="dist-name">{dist.name}</div>
      <div className="dist-bars" role="img" aria-label={`${dist.name} P&L distribution`}>
        {dist.bins.map((b, i) => (
          <div key={i} title={`${usd(b.x0)} to ${usd(b.x1)}: ${b.count}`}
            style={{ height: `${(b.count / peak) * 100}%` }} />
        ))}
      </div>
      <div className="dist-stats">
        <span>p5 {usd(dist.stats.p5)}</span>
        <span>median {usd(dist.stats.median)}</span>
        <span>p95 {usd(dist.stats.p95)}</span>
        <span className="oracle">oracle {usd(oracle)}</span>
      </div>
    </div>
  );
}

export default function StressCard({ params, mix, oracle }: { params: LabParams; mix: FleetMix; oracle: number }) {
  const stress = useStress();
  const [runs, setRuns] = useState(50);
  const [sigma, setSigma] = useState(0.25);
  return (
    <div className="card span-2">
      <h2>Stress test - P&amp;L under forecast error</h2>
      <div className="lab-form">
        <label className="stress-label">runs
          <input aria-label="runs" type="number" min={5} max={200} value={runs}
            onChange={(e) => setRuns(Math.max(5, Math.min(200, Number(e.target.value) || 50)))} />
        </label>
        <label className="stress-label">forecast noise {Math.round(sigma * 100)}%
          <input aria-label="noise" type="range" min={0.05} max={0.5} step={0.05} value={sigma}
            onChange={(e) => setSigma(Number(e.target.value))} />
        </label>
        <button className="primary" disabled={stress.running}
          onClick={() => stress.start(params, mix, runs, sigma)}>
          {stress.running ? `Run ${stress.result?.runsDone ?? 0}/${stress.result?.total ?? runs + 1}` : 'Run stress test'}
        </button>
      </div>
      <p className="stress-hint">Strategies trade real prices; each run perturbs the day-ahead forecast they plan on. Week-scale windows recommended.</p>
      {stress.running && <div className="lab-progress"><div style={{ width: `${stress.progress * 100}%` }} /></div>}
      {stress.error && <p className="lab-error">{stress.error}</p>}
      {stress.result && stress.result.dists.map((d) => <Distribution key={d.name} dist={d} oracle={oracle} />)}
    </div>
  );
}
