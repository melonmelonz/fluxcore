import { useEffect, useState } from 'react';
import { parseScenario } from '../core/scenario';
import type { Scenario } from '../core/types';
import type { FleetMix } from '../core/units';
import ControlBar from './components/ControlBar';
import DecisionLog from './components/DecisionLog';
import FleetDesigner from './components/FleetDesigner';
import FleetPanel from './components/FleetPanel';
import PnlStrip from './components/PnlStrip';
import WearPanel from './components/WearPanel';
import PriceChart from './components/PriceChart';
import StormBadge from './components/StormBadge';
import { download, ledgerCSV } from './export';
import LabView from './lab/LabView';
import { decodeLab } from './lab/share';
import { LiveView } from './LiveView';
import { loadMix, saveMix } from './mixStorage';
import { isStorm } from './storm';
import { useLiveDesk } from './useLiveDesk';
import { hotkeyAction } from './hotkeys';
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
  const [mix, setMix] = useState<FleetMix>(loadMix);
  const isLive = scenarioId === 'live';
  const updateMix = (m: FleetMix) => { setMix(m); saveMix(m); };
  const sim = useSimulation(isLive ? null : scenario, mix);
  const live = useLiveDesk(isLive);
  const storm = isStorm(isLive ? live?.rtm.at(-1)?.price : sim.snap?.price);

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

  const deskActive = view === 'desk' && !isLive;
  const { setPlaying, setSpeed } = sim;
  useEffect(() => {
    if (!deskActive) return;
    const onKey = (e: KeyboardEvent) => {
      const action = hotkeyAction(e);
      if (!action) return;
      e.preventDefault(); // space must not scroll the page
      if (action.type === 'toggle') setPlaying((p) => !p);
      else setSpeed(action.speed);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deskActive, setPlaying, setSpeed]);

  if (error) return <main className="app"><div className="card">{error}</div></main>;

  return (
    <main className={storm ? 'app storm' : 'app'}>
      <header className="brand span-2">
        <h1>
          <img src="/brand/fluxcore-emblem.png" alt="" />
          <span><b>flux</b>core</span>
        </h1>
        <span>virtual power plant arbitrage engine</span>
        <nav className="tabs">
          <button aria-pressed={view === 'desk'} onClick={() => setView('desk')}>Desk</button>
          <button aria-pressed={view === 'lab'} onClick={() => setView('lab')}>Lab</button>
        </nav>
      </header>
      {view === 'lab' ? (
        <LabView initial={initialLab} mix={mix} onMix={updateMix} />
      ) : isLive ? (
        <LiveView live={live} controls={
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
        } />
      ) : (
        <>
          <div className="card span-2">
            <h2>{scenario?.name ?? 'loading'} - ERCOT HB_NORTH - $/MWh{' '}<StormBadge storm={storm} /></h2>
            <PriceChart snap={sim.snap} epoch={sim.epoch} storm={storm} />
          </div>
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
          <PnlStrip snap={sim.snap} />
          <FleetPanel snap={sim.snap} />
          <WearPanel snap={sim.snap} />
          <FleetDesigner mix={mix} onMix={updateMix} />
          <div className="card span-2">
            <h2>Dispatch log
              <button className="export-btn"
                onClick={() => download(`fluxcore-dispatch-${scenarioId}.csv`, ledgerCSV(sim.exportEntries()))}>
                Export CSV
              </button>
            </h2>
            <DecisionLog snap={sim.snap} />
          </div>
        </>
      )}
    </main>
  );
}
