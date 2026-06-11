import type { Season } from './types';

const WINDOWS: Record<Season, [rise: number, set: number]> = {
  summer: [6, 20],
  shoulder: [7, 19],
  winter: [8, 18],
};

/** Clear-sky output for a panel with the given peak rating, at local hour-of-day. */
export function solarOutputKW(peakKW: number, hourOfDay: number, season: Season): number {
  const [rise, set] = WINDOWS[season];
  if (hourOfDay < rise || hourOfDay >= set) return 0;
  return peakKW * Math.sin((Math.PI * (hourOfDay - rise)) / (set - rise));
}

/** Map a calendar month (1-12) to the solar season used by the engine. */
export function seasonForMonth(month: number): Season {
  if (month >= 6 && month <= 9) return 'summer';
  if (month === 12 || month <= 2) return 'winter';
  return 'shoulder';
}
