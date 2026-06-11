import { useEffect, useRef, useState } from 'react';
import type { FleetMix } from '../../core/units';
import FleetDesigner from '../components/FleetDesigner';
import { download, labRunCSV } from '../export';
import { encodeLab, type LabParams } from './share';
import StressCard from './StressCard';
import { useLab } from './useLab';

const usd = (n: number) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LabView({ initial, mix, onMix }: { initial: LabParams | null; mix: FleetMix; onMix: (m: FleetMix) => void }) {
  const lab = useLab();
  const [hub, setHub] = useState(initial?.hub ?? 'HB_NORTH');
  const [start, setStart] = useState(initial?.start ?? '2023-08-14');
  const [end, setEnd] = useState(initial?.end ?? '2023-08-21');
  const autoRan = useRef(false);

  const { index, start: startRun } = lab;
  useEffect(() => {
    if (initial && index && !autoRan.current) {
      autoRan.current = true;
      startRun(initial, mix);
    }
  }, [initial, index, startRun, mix]);

  const months = lab.index?.months ?? [];
  const min = months.length ? `${months[0]}-01` : undefined;
  const max = months.length ? `${months[months.length - 1]}-28` : undefined;
  const params: LabParams = { hub, start, end };

  return (
    <>
      <div className="card span-2">
        <h2>Backtest lab — ERCOT historical archive</h2>
        <div className="lab-form">
          <select aria-label="hub" value={hub} onChange={(e) => setHub(e.target.value)}>
            {(lab.index?.hubs ?? ['HB_NORTH']).map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <input aria-label="start" type="date" value={start} min={min} max={max}
            onChange={(e) => setStart(e.target.value)} />
          <input aria-label="end" type="date" value={end} min={min} max={max}
            onChange={(e) => setEnd(e.target.value)} />
          <button className="primary" disabled={lab.running || start >= end}
            onClick={() => { window.location.hash = encodeLab(params); lab.start(params, mix); }}>
            {lab.running ? `Running ${Math.round(lab.progress * 100)}%` : 'Run backtest'}
          </button>
        </div>
        {lab.running && <div className="lab-progress"><div style={{ width: `${lab.progress * 100}%` }} /></div>}
        {lab.error && <p className="lab-error">{lab.error}</p>}
      </div>
      {lab.run && (
        <>
          <div className="card span-2">
            <h2>
              Results — {lab.run.params.hub} {lab.run.params.start} → {lab.run.params.end}
              <span className="lab-points">{lab.run.points.toLocaleString()} intervals</span>
              <button className="export-btn" onClick={() =>
                download(`fluxcore-lab-${lab.run!.params.hub}-${lab.run!.params.start}-${lab.run!.params.end}.csv`, labRunCSV(lab.run!))}>
                CSV
              </button>
              <button className="export-btn" onClick={() =>
                download(`fluxcore-lab-${lab.run!.params.hub}-${lab.run!.params.start}-${lab.run!.params.end}.json`,
                  JSON.stringify(lab.run, null, 2), 'application/json')}>
                JSON
              </button>
            </h2>
            <table className="lab-table">
              <thead>
                <tr><th>strategy</th><th>P&amp;L</th><th>% of oracle</th><th>MWh out</th><th>dispatches</th><th>left on table</th></tr>
              </thead>
              <tbody>
                {lab.run.results.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td className={r.pnl >= 0 ? 'pos' : 'neg'}>{usd(r.pnl)}</td>
                    <td>{lab.run!.oracle > 0 ? `${((r.pnl / lab.run!.oracle) * 100).toFixed(1)}%` : '—'}</td>
                    <td>{r.mwhDischarged.toFixed(1)}</td>
                    <td>{r.dispatches}</td>
                    <td className="neg">{usd(lab.run!.oracle - r.pnl)}</td>
                  </tr>
                ))}
                <tr className="lab-oracle">
                  <td>oracle (perfect hindsight)</td>
                  <td className="pos">{usd(lab.run.oracle)}</td>
                  <td>100%</td><td>—</td><td>—</td><td>$0.00</td>
                </tr>
              </tbody>
            </table>
          </div>
          <StressCard params={lab.run.params} mix={mix} oracle={lab.run.oracle} />
        </>
      )}
      <FleetDesigner mix={mix} onMix={onMix} />
    </>
  );
}
