import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PRESETS } from '../../core/units';
import FleetDesigner from '../components/FleetDesigner';
import { loadMix, saveMix } from '../mixStorage';

describe('mixStorage', () => {
  it('round-trips a saved mix', () => {
    saveMix(PRESETS[1].mix);
    expect(loadMix()).toEqual(PRESETS[1].mix);
  });
  it('falls back to the suburban default on garbage', () => {
    localStorage.setItem('fluxcore.fleetMix', '{nope');
    expect(loadMix()).toEqual(PRESETS[0].mix);
    localStorage.setItem('fluxcore.fleetMix', JSON.stringify([{ type: 'flying-car', count: 5 }]));
    expect(loadMix()).toEqual(PRESETS[0].mix);
    localStorage.setItem('fluxcore.fleetMix', JSON.stringify([{ type: 'home', count: -3 }]));
    expect(loadMix()).toEqual(PRESETS[0].mix);
  });
});

describe('FleetDesigner', () => {
  it('shows presets and the live capacity readout', () => {
    render(<FleetDesigner mix={PRESETS[0].mix} onMix={() => {}} />);
    expect(screen.getByRole('button', { name: 'Suburban 200' })).toBeTruthy();
    expect(screen.getByText(/2.7 MWh/)).toBeTruthy();
    expect(screen.getByText(/1.0 MW/)).toBeTruthy();
  });
  it('reports stepper edits through onMix', () => {
    let got = null as unknown;
    render(<FleetDesigner mix={PRESETS[0].mix} onMix={(m) => { got = m; }} />);
    fireEvent.change(screen.getByLabelText('EV (away 8a-6p)'), { target: { value: '40' } });
    expect(got).toEqual([{ type: 'home', count: 200 }, { type: 'ev', count: 40 }]);
  });
});
