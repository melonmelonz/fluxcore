import type { SimSnapshot } from '../../core/controller';

const LABELS: Record<string, string> = { threshold: 'Threshold', 'lp-optimizer': 'LP Optimizer' };
const usd = (v: number) =>
  `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PnlStrip({ snap }: { snap: SimSnapshot | null }) {
  return (
    <div className="card span-2">
      <h2>Cumulative P&amp;L</h2>
      <div className="kpis">
        {(snap?.lanes ?? []).map((lane) => (
          <div className="kpi" key={lane.name}>
            <div className="label">{LABELS[lane.name] ?? lane.name}</div>
            <div className={`value ${lane.pnl >= 0 ? 'pos' : 'neg'}`}>{usd(lane.pnl)}</div>
          </div>
        ))}
        {!snap && <div className="kpi"><div className="label">press play</div></div>}
      </div>
    </div>
  );
}
