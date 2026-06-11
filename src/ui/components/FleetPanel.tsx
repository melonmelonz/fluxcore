import type { SimSnapshot } from '../../core/controller';

export default function FleetPanel({ snap }: { snap: SimSnapshot | null }) {
  // the LP lane is the "real" plant; threshold is the shadow baseline
  const fleet = snap?.lanes[snap.lanes.length - 1]?.fleet;
  const socPct = fleet ? Math.round((fleet.socKWh / fleet.capacityKWh) * 100) : 0;
  return (
    <div className="card">
      <h2>Fleet</h2>
      <div className="fleet-grid">
        <div>
          <div className="label">Units online</div>
          <div className="value">{fleet?.homesOnline ?? 0}</div>
        </div>
        <div>
          <div className="label">Dispatchable</div>
          <div className="value">{((fleet?.maxDischargeKW ?? 0) / 1000).toFixed(1)} MW</div>
        </div>
        <div>
          <div className="label">State of charge</div>
          <div className="value">{socPct}%</div>
          <div className="meter"><div style={{ width: `${socPct}%` }} /></div>
        </div>
        <div>
          <div className="label">Solar now</div>
          <div className="value">{((fleet?.solarKWNow ?? 0) / 1000).toFixed(2)} MW</div>
        </div>
      </div>
    </div>
  );
}
