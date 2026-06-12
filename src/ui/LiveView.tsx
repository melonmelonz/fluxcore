import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { SimSnapshot } from '../core/controller';
import DecisionLog from './components/DecisionLog';
import FleetPanel from './components/FleetPanel';
import PnlStrip from './components/PnlStrip';
import StormBadge from './components/StormBadge';
import { isStorm } from './storm';
import { chartPalette, type Theme } from './theme';
import type { LiveState } from './useLiveDesk';

const STALE_MS = 20 * 60_000;

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function LiveBadge({ lastUpdated }: { lastUpdated: number | null }) {
  const now = useNow(30_000);
  if (lastUpdated === null) return <span className="live-badge connecting">CONNECTING…</span>;
  if (now - lastUpdated > STALE_MS) {
    const min = Math.round((now - lastUpdated) / 60_000);
    return <span className="live-badge stale">STALE ({min}m)</span>;
  }
  return <span className="live-badge on">LIVE</span>;
}

function LiveChart({ points, storm, theme }: { points: { t: number; price: number }[]; storm: boolean; theme: Theme }) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Area'> | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const pal = chartPalette[theme];
    const c = createChart(host.current, {
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: pal.text, fontSize: 11 },
      grid: { vertLines: { color: pal.grid }, horzLines: { color: pal.grid } },
      rightPriceScale: { borderColor: pal.border },
      timeScale: { borderColor: pal.border, timeVisible: true, secondsVisible: false },
    });
    series.current = c.addAreaSeries({
      lineColor: '#2E86E0',
      topColor: 'rgba(46, 134, 224, 0.28)',
      bottomColor: 'rgba(46, 134, 224, 0.02)',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    chart.current = c;
    return () => { c.remove(); chart.current = null; series.current = null; };
  }, [theme]);

  useEffect(() => {
    series.current?.applyOptions(storm
      ? { lineColor: '#F5A623', topColor: 'rgba(245, 166, 35, 0.28)', bottomColor: 'rgba(245, 166, 35, 0.02)' }
      : { lineColor: '#2E86E0', topColor: 'rgba(46, 134, 224, 0.28)', bottomColor: 'rgba(46, 134, 224, 0.02)' });
  }, [storm, theme]);

  useEffect(() => {
    if (!series.current) return;
    series.current.setData(points.map((p) => ({ time: (p.t / 1000) as UTCTimestamp, value: p.price })));
    chart.current?.timeScale().fitContent();
  // theme in deps: data must be re-fed after the chart rebuilds for a theme switch
  }, [points, theme]);

  return <div className="chart-host" ref={host} />;
}

/** Adapt live desk state into the SimSnapshot shape the shared panels consume. */
function toSnapshot(live: LiveState): SimSnapshot | null {
  const last = live.rtm[live.rtm.length - 1];
  if (!last) return null;
  return {
    t: last.t,
    price: last.price,
    progress: 1,
    done: false,
    lanes: live.lanes.map((l) => ({
      name: l.name,
      pnl: l.pnl,
      lastAction: null,
      fleet: {
        homesOnline: l.homesOnline,
        socKWh: l.socKWh,
        capacityKWh: l.capacityKWh,
        chargeHeadroomKWh: l.capacityKWh - l.socKWh,
        maxChargeKW: l.maxDischargeKW ?? 0,
        maxDischargeKW: l.maxDischargeKW ?? 0,
        roundTripEfficiency: 0.86,
        degradationCostPerMWh: 20,
        solarKWNow: 0,
      },
    })),
    recent: live.lanes.flatMap((l) => l.recent).sort((a, b) => a.t - b.t).slice(-50),
  };
}

export function LiveView({ live, controls, theme = 'dark' }: { live: LiveState | null; controls?: ReactNode; theme?: Theme }) {
  const snap = live ? toSnapshot(live) : null;
  const storm = isStorm(live?.rtm.at(-1)?.price ?? null);
  return (
    <>
      <div className="card span-2">
        <h2>
          Live — ERCOT HB_NORTH — $/MWh <LiveBadge lastUpdated={live?.lastUpdated ?? null} />
          {' '}<StormBadge storm={storm} />
        </h2>
        <LiveChart points={live?.rtm ?? []} storm={storm} theme={theme} />
      </div>
      {controls}
      <PnlStrip snap={snap} />
      <FleetPanel snap={snap} />
      <div className="card span-2">
        <h2>Dispatch log</h2>
        <DecisionLog snap={snap} />
      </div>
    </>
  );
}
