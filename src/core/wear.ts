import type { Ledger } from './ledger';

export interface WearStats {
  /** equivalent full cycles: MWh discharged / fleet capacity in MWh */
  cycles: number;
  mwhDischarged: number;
  /** accrued degradation cost in dollars */
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
