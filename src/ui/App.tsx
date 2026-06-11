import { useEffect, useState } from 'react';
import { parseScenario } from '../core/scenario';
import type { Scenario } from '../core/types';
import ControlBar from './components/ControlBar';
import DecisionLog from './components/DecisionLog';
import FleetPanel from './components/FleetPanel';
import PnlStrip from './components/PnlStrip';
import PriceChart from './components/PriceChart';
import StormBadge from './components/StormBadge';
import LabView from './lab/LabView';
import { decodeLab } from './lab/share';
import { LiveView } from './LiveView';
import { isStorm } from './storm';
import { useLiveDesk } from './useLiveDesk';
import { useSimulation } from './useSimulation';

interface IndexEntry { id: string; name: string }

const LIVE_ENTRY: IndexEntry = { id: 'live', name: 'Live — ERCOT HB_NORTH' };

export default function App() {
  const [initialLab] = useState(() => decodeLab(window.location.hash));
  const [view, setView] = useState<'desk' | 'lab'>(initialLab ? 'lab' : 'desk');
  const [index, setIndex] = useState<IndexEntry[]>([]);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isLive = scenarioId === 'live';
  const sim = useSimulation(isLive ? null : scenario);
  const live = useLiveDesk(isLive);
  const storm = isStorm(isLive ? live?.rtm[live.rtm.length - 1]?.price : sim.snap?.price);

  useEffect(() => {
    fetch('/data/index.json')
      .then((r) => r.json())
      .then((idx: IndexEntry[]) => { setIndex(idx); setScenarioId(idx[0]?.id ?? null); })
      .catch(() => setError('failed to load scenario index'));
  }, []);

  useEffect(() => {
    if (!scenarioId || scenarioId === 'live') return;
    fetch(`/data/${scenarioId}.json`)
      .then((r) => r.json())
      .then((raw) => setScenario(parseScenario(raw)))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed to load scenario'));
  }, [scenarioId]);

  if (error) return <main className="app"><div className="card">{error}</div></main>;

  return (
    <main className={storm ? 'app storm' : 'app'}>
      <header className="brand span-2">
        <h1><b>flux</b>core</h1>
        <span>virtual power plant arbitrage engine</span>
        <nav className="tabs">
          <button aria-pressed={view === 'desk'} onClick={() => setView('desk')}>Desk</button>
          <button aria-pressed={view === 'lab'} onClick={() => setView('lab')}>Lab</button>
        </nav>
      </header>
      {view === 'lab' ? (
        <LabView initial={initialLab} />
      ) : isLive ? (
        <LiveView live={live} />
      ) : (
        <>
          <div className="card span-2">
            <h2>{scenario?.name ?? 'loading'} - ERCOT HB_NORTH - $/MWh{' '}<StormBadge storm={storm} /></h2>
            <PriceChart snap={sim.snap} epoch={sim.epoch} storm={storm} />
          </div>
          <PnlStrip snap={sim.snap} />
          <FleetPanel snap={sim.snap} />
          <div className="card span-2">
            <h2>Dispatch log</h2>
            <DecisionLog snap={sim.snap} />
          </div>
        </>
      )}
      {view === 'desk' && (
        <ControlBar
          scenarios={[LIVE_ENTRY, ...index]}
          scenarioId={scenarioId}
          onScenario={setScenarioId}
          playing={sim.playing}
          onPlay={() => sim.setPlaying(!sim.playing)}
          speed={sim.speed}
          onSpeed={sim.setSpeed}
          onReset={sim.reset}
          live={isLive}
        />
      )}
    </main>
  );
}
