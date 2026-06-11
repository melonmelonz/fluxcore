import { useEffect, useState } from 'react';
import type { PricePoint } from '../core/types';
import type { LedgerEntry } from '../core/ledger';

export interface LiveLane {
  name: string;
  pnl: number;
  socKWh: number;
  capacityKWh: number;
  maxDischargeKW: number;
  homesOnline: number;
  recent: LedgerEntry[];
}
export interface LiveState {
  rtm: PricePoint[];
  dam: PricePoint[];
  lastUpdated: number | null;
  startedAt: number | null;
  lanes: LiveLane[];
}

const POLL_MS = 30_000;

export function useLiveDesk(enabled: boolean): LiveState | null {
  const [state, setState] = useState<LiveState | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    async function poll() {
      try {
        const [prices, desk] = await Promise.all([
          fetch('/api/prices/live').then((r) => r.json()),
          fetch('/api/desk').then((r) => r.json()),
        ]);
        if (stop) return;
        setState({
          rtm: prices.rtm ?? [],
          dam: prices.dam ?? [],
          lastUpdated: prices.lastUpdated ?? null,
          startedAt: desk.startedAt ?? null,
          lanes: desk.lanes ?? [],
        });
      } catch {
        /* keep last good state; badge handles staleness */
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { stop = true; clearInterval(id); };
  }, [enabled]);
  return state;
}
