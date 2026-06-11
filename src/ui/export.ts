import type { LedgerEntry } from '../core/ledger';
import type { LabRun } from './lab/useLab';

const esc = (v: string): string =>
  /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;

export function toCSV(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => esc(String(c))).join(',')).join('\r\n') + '\r\n';
}

export function ledgerCSV(entries: LedgerEntry[]): string {
  return toCSV([
    ['time_utc', 'strategy', 'action', 'mwh', 'price_usd_per_mwh', 'value_usd'],
    ...entries.map((e) => [new Date(e.t).toISOString(), e.strategy, e.action, e.mwh, e.price, e.value]),
  ]);
}

export function labRunCSV(run: LabRun): string {
  const pct = (pnl: number) => (run.oracle > 0 ? ((pnl / run.oracle) * 100).toFixed(1) : '');
  return toCSV([
    ['hub', 'start', 'end', 'intervals', 'strategy', 'pnl_usd', 'pct_of_oracle', 'mwh_charged', 'mwh_discharged', 'dispatches'],
    ...run.results.map((r) => [
      run.params.hub, run.params.start, run.params.end, run.points,
      r.name, r.pnl, pct(r.pnl), r.mwhCharged, r.mwhDischarged, r.dispatches,
    ]),
    [run.params.hub, run.params.start, run.params.end, run.points, 'oracle', run.oracle, '100.0', '', '', ''],
  ]);
}

export function download(filename: string, content: string, mime = 'text/csv'): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
