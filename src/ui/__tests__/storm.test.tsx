import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StormBadge from '../components/StormBadge';
import { isStorm, STORM_PRICE } from '../storm';

describe('isStorm', () => {
  it('is false below the threshold and true at or above it', () => {
    expect(isStorm(STORM_PRICE - 0.01)).toBe(false);
    expect(isStorm(STORM_PRICE)).toBe(true);
    expect(isStorm(5193.14)).toBe(true);
  });
  it('is false for negative prices and missing data', () => {
    expect(isStorm(-30.72)).toBe(false);
    expect(isStorm(null)).toBe(false);
    expect(isStorm(undefined)).toBe(false);
  });
});

describe('StormBadge', () => {
  it('renders STORM when stormy and nothing otherwise', () => {
    const { rerender } = render(<StormBadge storm={true} />);
    expect(screen.getByText('STORM')).toBeTruthy();
    rerender(<StormBadge storm={false} />);
    expect(screen.queryByText('STORM')).toBeNull();
  });
});
