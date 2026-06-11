import { type FleetMix, mixTotals, PRESETS, UNIT_TYPES, type UnitTypeId } from '../../core/units';

const sameMix = (a: FleetMix, b: FleetMix) => JSON.stringify(a) === JSON.stringify(b);
const countOf = (mix: FleetMix, type: UnitTypeId) => mix.find((e) => e.type === type)?.count ?? 0;

export default function FleetDesigner({ mix, onMix }: { mix: FleetMix; onMix: (m: FleetMix) => void }) {
  const t = mixTotals(mix);
  const setCount = (type: UnitTypeId, count: number) => {
    const next = (Object.keys(UNIT_TYPES) as UnitTypeId[])
      .map((u) => ({ type: u, count: u === type ? count : countOf(mix, u) }))
      .filter((e) => e.count > 0);
    onMix(next.length ? next : PRESETS[0].mix);
  };
  return (
    <div className="card">
      <h2>Fleet designer</h2>
      <div className="designer-presets">
        {PRESETS.map((p) => (
          <button key={p.id} aria-pressed={sameMix(p.mix, mix)} onClick={() => onMix(p.mix)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="designer-units">
        {(Object.keys(UNIT_TYPES) as UnitTypeId[]).map((u) => (
          <label key={u}>
            <span>{UNIT_TYPES[u].label}</span>
            <input aria-label={UNIT_TYPES[u].label} type="number" min={0} max={1000}
              value={countOf(mix, u)}
              onChange={(e) => setCount(u, Math.max(0, Math.min(1000, Number(e.target.value) || 0)))} />
          </label>
        ))}
      </div>
      <div className="designer-totals">
        {t.units} units - {(t.capacityKWh / 1000).toFixed(1)} MWh - {(t.maxDischargeKW / 1000).toFixed(1)} MW
      </div>
    </div>
  );
}
