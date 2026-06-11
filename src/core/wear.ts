import type { Ledger } from './ledger';

export interface WearStats {
  /** equivalent full cycles: MWh discharged / fleet capacity in MWh */
  cycles: number;
  mwhDischarged: number;
  /**
   * Accrued degradation cost in dollars (mwhDischarged x rate).
   * This is the wear component already embedded in P&L - shown standalone
   * so the hidden cost of cycling the batteries is visible.
   */
  degradationDollars: number;
}

export function wearStats(ledger: Ledger, capacityKWh: number, degradationCostPerMWh: number): WearStats {
  const mwhDischarged = ledger.mwhDischarged;
  const capacityMWh = capacityKWh / 1000;
  return {
    cycles: capacityMWh > 0 ? mwhDischarged / capacityMWh : 0,
    mwhDischarged,
    degradationDollars: mwhDischarged * degradationCostPerMWh,
  };
}
