import { describe, expect, it } from 'vitest';
import { mergePoints } from '../lib/merge';

const p = (t: number, price: number) => ({ t, price });
const DAY = 86_400_000;

describe('mergePoints', () => {
  it('appends new points in order and dedupes by timestamp (incoming wins)', () => {
    const merged = mergePoints([p(1000, 10), p(2000, 20)], [p(2000, 21), p(3000, 30)], 3000, DAY);
    expect(merged).toEqual([p(1000, 10), p(2000, 21), p(3000, 30)]);
  });
  it('trims points older than maxAge', () => {
    const merged = mergePoints([p(0, 1)], [p(DAY + 1000, 2)], DAY + 1000, DAY);
    expect(merged).toEqual([p(DAY + 1000, 2)]);
  });
  it('handles empty existing cache', () => {
    expect(mergePoints([], [p(1, 1)], 1, DAY)).toEqual([p(1, 1)]);
  });
});
