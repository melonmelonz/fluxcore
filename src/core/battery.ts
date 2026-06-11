export interface BatterySpec {
  capacityKWh: number;
  maxChargeKW: number;
  maxDischargeKW: number;
  /** 0..1, applied entirely on charge */
  roundTripEfficiency: number;
  /** $ per MWh discharged */
  degradationCostPerMWh: number;
  initialSoCKWh?: number;
}

export class Battery {
  private socKWh: number;

  constructor(readonly spec: BatterySpec) {
    this.socKWh = spec.initialSoCKWh ?? 0;
  }

  get soc(): number {
    return this.socKWh;
  }

  get headroomKWh(): number {
    return this.spec.capacityKWh - this.socKWh;
  }

  charge(kW: number, minutes: number): { storedKWh: number; drawnKWh: number } {
    const hours = minutes / 60;
    let drawn = Math.max(0, Math.min(kW, this.spec.maxChargeKW)) * hours;
    let stored = drawn * this.spec.roundTripEfficiency;
    if (stored > this.headroomKWh) {
      stored = this.headroomKWh;
      drawn = stored / this.spec.roundTripEfficiency;
    }
    this.socKWh += stored;
    return { storedKWh: stored, drawnKWh: drawn };
  }

  discharge(kW: number, minutes: number): { deliveredKWh: number } {
    const hours = minutes / 60;
    const delivered = Math.min(Math.max(0, Math.min(kW, this.spec.maxDischargeKW)) * hours, this.socKWh);
    this.socKWh -= delivered;
    return { deliveredKWh: delivered };
  }
}
