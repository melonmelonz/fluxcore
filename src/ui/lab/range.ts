const HOUR_MS = 3_600_000;
const CENTRAL_OFFSET_MS = 6 * HOUR_MS; // fixed UTC-6, matches engine

/** Months ('YYYY-MM') whose chunks cover [start, end], inclusive. */
export function monthsInRange(startISO: string, endISO: string): string[] {
  const [sy, sm] = startISO.split('-').map(Number);
  const [ey, em] = endISO.split('-').map(Number);
  const out: string[] = [];
  for (let y = sy, m = sm; y < ey || (y === ey && m <= em); m === 12 ? (y++, m = 1) : m++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return out;
}

/** Longest runnable window. The oracle LP is synchronous; beyond ~a quarter it
 *  would lock the tab (and share links auto-run, so this must be enforced, not
 *  just suggested by the form). */
export const MAX_LAB_DAYS = 92;

export function rangeDays(startISO: string, endISO: string): number {
  const { lo, hi } = rangeMs(startISO, endISO);
  return (hi - lo) / 86_400_000;
}

/** [lo, hi) epoch-ms window: Central midnight of start to Central midnight of end. */
export function rangeMs(startISO: string, endISO: string): { lo: number; hi: number } {
  const ms = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d) + CENTRAL_OFFSET_MS;
  };
  return { lo: ms(startISO), hi: ms(endISO) };
}
