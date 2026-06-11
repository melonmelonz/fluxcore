import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LiveBadge } from '../LiveView';

describe('LiveBadge', () => {
  it('shows LIVE when fresh', () => {
    render(<LiveBadge lastUpdated={Date.now() - 60_000} />);
    expect(screen.getByText('LIVE')).toBeTruthy();
  });
  it('shows STALE when the feed is older than 20 minutes', () => {
    render(<LiveBadge lastUpdated={Date.now() - 21 * 60_000} />);
    expect(screen.getByText(/STALE/)).toBeTruthy();
  });
  it('shows CONNECTING with no data', () => {
    render(<LiveBadge lastUpdated={null} />);
    expect(screen.getByText(/CONNECTING/)).toBeTruthy();
  });
});
