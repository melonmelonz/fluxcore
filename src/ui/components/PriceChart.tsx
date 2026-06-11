import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import type { SimSnapshot } from '../../core/controller';

export default function PriceChart({ snap, epoch }: { snap: SimSnapshot | null; epoch: number }) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Area'> | null>(null);
  const markers = useRef<{ time: UTCTimestamp; position: 'aboveBar' | 'belowBar'; color: string; shape: 'arrowUp' | 'arrowDown' }[]>([]);

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
    return () => { c.remove(); chart.current = null; series.current = null; };
  }, [epoch]);

  useEffect(() => {
    if (!snap || !series.current) return;
    const time = (snap.t / 1000) as UTCTimestamp;
    series.current.update({ time, value: snap.price });
    const lp = snap.recent.filter((e) => e.strategy === 'lp-optimizer');
    const last = lp[lp.length - 1];
    if (last && last.t === snap.t) {
      markers.current = [
        ...markers.current.slice(-199),
        last.action === 'charge'
          ? { time, position: 'belowBar' as const, color: '#4FC3F7', shape: 'arrowUp' as const }
          : { time, position: 'aboveBar' as const, color: '#2EBD85', shape: 'arrowDown' as const },
      ];
      series.current.setMarkers(markers.current);
    }
  }, [snap]);

  return <div className="chart-host" ref={host} />;
}
