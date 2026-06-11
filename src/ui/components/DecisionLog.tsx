import type { SimSnapshot } from '../../core/controller';

const fmt = (t: number) =>
  new Date(t).toLocaleString('en-US', {
    month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: 'America/Chicago',
  });

export default function DecisionLog({ snap }: { snap: SimSnapshot | null }) {
  const rows = snap?.recent ?? [];
  return (
    <div className="log" role="log" aria-label="dispatch log">
      {rows.map((e, i) => (
        <div className="row" key={`${e.t}-${e.strategy}-${i}`}>
          <span className="t">{fmt(e.t)}</span>
          <span className="strat">{e.strategy === 'lp-optimizer' ? 'lp' : 'thresh'}</span>
          <span className={e.action}>{e.action}</span>
          <span>{(e.mwh * 1000).toFixed(0)} kWh @ ${e.price.toFixed(2)}/MWh</span>
        </div>
      ))}
      {rows.length === 0 && <div className="row"><span className="t">no dispatches yet</span></div>}
    </div>
  );
}
