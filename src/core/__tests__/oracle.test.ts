import { describe, expect, it } from 'vitest';
import { oraclePnl, type OracleFleetSpec } from '../oracle';

const NIGHT = Date.UTC(2024, 0, 15, 6, 0); // 00:00 Central — winter, no solar at night

const SPEC: OracleFleetSpec = {
  capacityKWh: 1000,
  maxChargeKW: 1000,
  maxDischargeKW: 1000,
  roundTripEfficiency: 1,
  degradationCostPerMWh: 0,
  solarPeakKW: 0,
};

describe('oraclePnl', () => {
  it('captures a perfect two-interval spread exactly', () => {
    const rtm = [
      { t: NIGHT, price: 10 },
      { t: NIGHT + 3_600_000, price: 1000 },
    ];
    // charge 1 MWh @ $10, discharge 1 MWh @ $1000
    expect(oraclePnl(rtm, SPEC, 'winter', 60)).toBeCloseTo(990, 6);
  });

  it('holds when the spread cannot clear efficiency + degradation', () => {
    const rtm = [
      { t: NIGHT, price: 100 },
      { t: NIGHT + 3_600_000, price: 200 },
    ];
    const spec = { ...SPEC, roundTripEfficiency: 0.5, degradationCostPerMWh: 20 };
    expect(oraclePnl(rtm, spec, 'winter', 60)).toBeCloseTo(0, 6);
  });

  it('returns zero on flat prices with no solar', () => {
    const rtm = Array.from({ length: 96 }, (_, i) => ({ t: NIGHT + i * 900_000, price: 50 }));
    const spec = { ...SPEC, roundTripEfficiency: 0.86, degradationCostPerMWh: 20 };
    expect(oraclePnl(rtm, spec, 'winter', 15)).toBeCloseTo(0, 6);
  });

  it('monetizes free solar even on flat prices', () => {
    const noon = Date.UTC(2023, 7, 20, 18, 0); // 12:00 Central, summer
    const rtm = [
      { t: noon, price: 100 },
      { t: noon + 3_600_000, price: 100 },
    ];
    const spec = { ...SPEC, roundTripEfficiency: 1, degradationCostPerMWh: 20, solarPeakKW: 1000 };
    expect(oraclePnl(rtm, spec, 'summer', 60)).toBeGreaterThan(0);
  });

  it('carries SoC across day boundaries', () => {
    // cheap last interval of day 1, expensive first interval of day 2
    const lastOfDay = Date.UTC(2024, 0, 15, 5, 0); // 23:00 Central Jan 14
    const rtm = [
      { t: lastOfDay, price: 5 },
      { t: lastOfDay + 3_600_000, price: 500 },
    ];
    expect(oraclePnl(rtm, SPEC, 'winter', 60)).toBeCloseTo(495, 6);
  });
});
