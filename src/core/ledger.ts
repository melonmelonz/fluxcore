export interface LedgerEntry {
  t: number;
  strategy: string;
  action: 'charge' | 'discharge';
  mwh: number;
  /** $/MWh at execution */
  price: number;
  /** signed dollars: negative = cost, positive = revenue */
  value: number;
}

export class Ledger {
  readonly entries: LedgerEntry[] = [];

  record(entry: LedgerEntry): void {
    this.entries.push(entry);
  }

  get pnl(): number {
    return this.entries.reduce((s, e) => s + e.value, 0);
  }

  tail(n: number): LedgerEntry[] {
    return this.entries.slice(-n);
  }
}
