import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Distribution } from '../lab/StressCard';

describe('Distribution', () => {
  it('renders stats and an oracle reference', () => {
    render(<Distribution dist={{
      name: 'lp-optimizer',
      pnls: [100, 80, 120, 90, 110],
      stats: { min: 80, p5: 80, median: 100, p95: 120, max: 120, mean: 100 },
      bins: [{ x0: 80, x1: 100, count: 2 }, { x0: 100, x1: 120, count: 3 }],
    }} oracle={150} />);
    expect(screen.getByText(/lp-optimizer/)).toBeTruthy();
    expect(screen.getByText(/median \$100\.00/)).toBeTruthy();
    expect(screen.getByText(/p5 \$80\.00/)).toBeTruthy();
    expect(screen.getByText(/oracle \$150\.00/)).toBeTruthy();
  });
});
