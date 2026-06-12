import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import type { SimSnapshot } from '../../core/controller';
import type { LedgerEntry } from '../../core/ledger';

/** Lazily provides full chart state up to "now" — used to rebuild the chart after
 *  a back-step, since lightweight-charts throws on out-of-order update(). */
export type ChartSeed = () => { points: { t: number; price: number }[]; entries: LedgerEntry[] };

const mark = (t: number, action: LedgerEntry['action']) =>
  action === 'charge'
    ? { time: (t / 1000) as UTCTimestamp, position: 'belowBar' as const, color: '#4FC3F7', shape: 'arrowUp' as const }
    : { time: (t / 1000) as UTCTimestamp, position: 'aboveBar' as const, color: '#2EBD85', shape: 'arrowDown' as const };

export default function PriceChart({ snap, epoch, storm = false, seed }: { snap: SimSnapshot | null; epoch: number; storm?: boolean; seed?: ChartSeed }) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Area'> | null>(null);
  const markers = useRef<ReturnType<typeof mark>[]>([]);
  const lastTime = useRef(0);
  const seedRef = useRef(seed);
  // declared before the epoch effect so the seed is fresh when the chart rebuilds
  useEffect(() => { seedRef.current = seed; });

  useEffect(() => {
    if (!host.current) return;
    const c = createChart(host.current, {
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: '#7E93AC', fontSize: 11 },
      grid: { vertLines: { color: '#16263B' }, horzLines: { color: '#16263B' } },
      rightPriceScale: { borderColor: '#243A55' },
      timeScale: { borderColor: '#243A55', timeVisible: true, secondsVisible: false },
    });
    const s = c.addAreaSeries({
      lineColor: '#2E86E0',
      topColor: 'rgba(46, 134, 224, 0.28)',
      bottomColor: 'rgba(46, 134, 224, 0.02)',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    chart.current = c;
    series.current = s;
    markers.current = [];
    lastTime.current = 0;
    const sd = seedRef.current?.();
    if (sd && sd.points.length > 0) {
      s.setData(sd.points.map((p) => ({ time: (p.t / 1000) as UTCTimestamp, value: p.price })));
      lastTime.current = (sd.points[sd.points.length - 1].t / 1000);
      markers.current = sd.entries.slice(-200).map((e) => mark(e.t, e.action));
      s.setMarkers(markers.current);
    }
    return () => { c.remove(); chart.current = null; series.current = null; };
  }, [epoch]);

  useEffect(() => {
    if (!snap || !series.current) return;
    const time = (snap.t / 1000) as UTCTimestamp;
    if ((time as number) < lastTime.current) return; // never feed out-of-order points
    lastTime.current = time as number;
    series.current.update({ time, value: snap.price });
    const lp = snap.recent.filter((e) => e.strategy === 'lp-optimizer');
    const last = lp[lp.length - 1];
    if (last && last.t === snap.t && markers.current[markers.current.length - 1]?.time !== time) {
      markers.current = [...markers.current.slice(-199), mark(last.t, last.action)];
      series.current.setMarkers(markers.current);
    }
  }, [snap]);

  useEffect(() => {
    series.current?.applyOptions(storm
      ? { lineColor: '#F5A623', topColor: 'rgba(245, 166, 35, 0.28)', bottomColor: 'rgba(245, 166, 35, 0.02)' }
      : { lineColor: '#2E86E0', topColor: 'rgba(46, 134, 224, 0.28)', bottomColor: 'rgba(46, 134, 224, 0.02)' });
  // epoch in deps: chart is recreated on scenario switch, so color must be reapplied
  }, [storm, epoch]);

  return <div className="chart-host" ref={host} />;
}
