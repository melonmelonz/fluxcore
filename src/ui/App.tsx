import { useEffect, useState } from 'react';
import { parseScenario } from '../core/scenario';
import type { Scenario } from '../core/types';
import ControlBar from './components/ControlBar';
import DecisionLog from './components/DecisionLog';
import FleetPanel from './components/FleetPanel';
import PnlStrip from './components/PnlStrip';
import PriceChart from './components/PriceChart';
import { useSimulation } from './useSimulation';

interface IndexEntry { id: string; name: string }

export default function App() {
  const [index, setIndex] = useState<IndexEntry[]>([]);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sim = useSimulation(scenario);

  useEffect(() => {
    fetch('/data/index.json')
      .then((r) => r.json())
      .then((idx: IndexEntry[]) => { setIndex(idx); setScenarioId(idx[0]?.id ?? null); })
      .catch(() => setError('failed to load scenario index'));
  }, []);

  useEffect(() => {
    if (!scenarioId) return;
    fetch(`/data/${scenarioId}.json`)
      .then((r) => r.json())
      .then((raw) => setScenario(parseScenario(raw)))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed to load scenario'));
  }, [scenarioId]);

  if (error) return <main className="app"><div className="card">{error}</div></main>;

  return (
    <main className="app">
      <header className="brand span-2">
        <h1><b>flux</b>core</h1>
        <span>virtual power plant arbitrage engine</span>
      </header>
      <div className="card span-2">
        <h2>{scenario?.name ?? 'loading'} - ERCOT HB_NORTH - $/MWh</h2>
        <PriceChart snap={sim.snap} epoch={sim.epoch} />
      </div>
      <PnlStrip snap={sim.snap} />
      <FleetPanel snap={sim.snap} />
      <div className="card span-2">
        <h2>Dispatch log</h2>
        <DecisionLog snap={sim.snap} />
      </div>
      <ControlBar
        scenarios={index}
        scenarioId={scenarioId}
        onScenario={setScenarioId}
        playing={sim.playing}
        onPlay={() => sim.setPlaying(!sim.playing)}
        speed={sim.speed}
        onSpeed={sim.setSpeed}
        onReset={sim.reset}
      />
    </main>
  );
}
