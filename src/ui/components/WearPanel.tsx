import type { SimSnapshot } from '../../core/controller';

const LABELS: Record<string, string> = { 'lp-optimizer': 'lp', threshold: 'thresh' };

const usd = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function WearPanel({ snap }: { snap: SimSnapshot | null }) {
  const lanes = snap?.lanes ?? [];
  return (
    <div className="card">
      <h2>Battery wear</h2>
      <div className="wear-grid">
        {lanes.map((l) => (
          <div key={l.name}>
            <div className="label">{LABELS[l.name] ?? l.name}</div>
            <div className="value">{l.wear ? `${l.wear.cycles.toFixed(2)} cycles` : '-'}</div>
            <div className="delta">{l.wear ? `${usd(l.wear.degradationDollars)} wear` : '-'}</div>
          </div>
        ))}
        {lanes.length === 0 && <div className="label">no data yet</div>}
      </div>
    </div>
  );
}
