import { describe, expect, it } from 'vitest';
import { seasonForMonth, solarOutputKW } from '../solar';

describe('solarOutputKW', () => {
  it('is zero at night', () => {
    expect(solarOutputKW(5, 0, 'summer')).toBe(0);
    expect(solarOutputKW(5, 23, 'winter')).toBe(0);
  });

  it('peaks at solar noon in summer (06:00-20:00 window)', () => {
    expect(solarOutputKW(5, 13, 'summer')).toBeCloseTo(5);
  });

  it('is symmetric around solar noon', () => {
    expect(solarOutputKW(5, 9, 'summer')).toBeCloseTo(solarOutputKW(5, 17, 'summer'));
  });

  it('has a shorter window in winter (08:00-18:00)', () => {
    expect(solarOutputKW(5, 7, 'winter')).toBe(0);
    expect(solarOutputKW(5, 13, 'winter')).toBeCloseTo(5);
  });
});

describe('seasonForMonth', () => {
  it('maps months to seasons', () => {
    expect(seasonForMonth(7)).toBe('summer'); // July
    expect(seasonForMonth(9)).toBe('summer'); // Sept (ERCOT heat runs long)
    expect(seasonForMonth(1)).toBe('winter');
    expect(seasonForMonth(12)).toBe('winter');
    expect(seasonForMonth(4)).toBe('shoulder');
    expect(seasonForMonth(10)).toBe('shoulder');
  });
});
