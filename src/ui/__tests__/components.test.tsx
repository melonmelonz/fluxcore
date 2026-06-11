import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SimSnapshot } from '../../core/controller';
import DecisionLog from '../components/DecisionLog';
import FleetPanel from '../components/FleetPanel';
import PnlStrip from '../components/PnlStrip';
import WearPanel from '../components/WearPanel';

const snap: SimSnapshot = {
  t: 1700000000000, price: 312, progress: 0.5, done: false,
  lanes: [
    { name: 'threshold', pnl: 120.5, fleet: fleet(800), lastAction: null },
    { name: 'lp-optimizer', pnl: 540.25, fleet: fleet(1900), lastAction: null },
  ],
  recent: [
    { t: 1700000000000, strategy: 'lp-optimizer', action: 'discharge', mwh: 0.25, price: 312, value: 73 },
  ],
};

function fleet(socKWh: number) {
  return {
    homesOnline: 200, socKWh, capacityKWh: 2700, chargeHeadroomKWh: 2700 - socKWh,
    maxChargeKW: 1000, maxDischargeKW: 1000, roundTripEfficiency: 0.86,
    degradationCostPerMWh: 20, solarKWNow: 420,
  };
}

describe('PnlStrip', () => {
  it('shows both strategies and formats P&L as dollars', () => {
    render(<PnlStrip snap={snap} />);
    expect(screen.getByText(/threshold/i)).toBeTruthy();
    expect(screen.getByText('$540.25')).toBeTruthy();
  });
});

describe('FleetPanel', () => {
  it('shows homes online and aggregate state of charge percent', () => {
    render(<FleetPanel snap={snap} />);
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.getByText(/70%/)).toBeTruthy(); // 1900 / 2700
  });
});

describe('DecisionLog', () => {
  it('renders dispatch entries', () => {
    render(<DecisionLog snap={snap} />);
    expect(screen.getByText(/discharge/)).toBeTruthy();
    expect(screen.getByText(/312/)).toBeTruthy();
  });
});

describe('WearPanel', () => {
  it('shows cycles and wear dollars per strategy', () => {
    const withWear: SimSnapshot = {
      ...snap,
      lanes: snap.lanes.map((l) => ({
        ...l,
        wear: { cycles: 4.25, mwhDischarged: 11.475, degradationDollars: 229.5 },
      })),
    };
    render(<WearPanel snap={withWear} />);
    expect(screen.getAllByText(/4.25 cycles/)).toHaveLength(2);
    expect(screen.getAllByText(/\$229.50/)).toHaveLength(2);
  });

  it('falls back to dashes when wear is absent', () => {
    render(<WearPanel snap={snap} />);
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });
});
