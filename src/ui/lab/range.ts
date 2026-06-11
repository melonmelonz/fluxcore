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

/** [lo, hi) epoch-ms window: Central midnight of start to Central midnight of end. */
export function rangeMs(startISO: string, endISO: string): { lo: number; hi: number } {
  const ms = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d) + CENTRAL_OFFSET_MS;
  };
  return { lo: ms(startISO), hi: ms(endISO) };
}
