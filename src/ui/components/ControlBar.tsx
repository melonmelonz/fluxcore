import { SPEEDS, type Speed } from '../useSimulation';

interface Props {
  scenarios: { id: string; name: string }[];
  scenarioId: string | null;
  onScenario: (id: string) => void;
  playing: boolean;
  onPlay: () => void;
  speed: Speed;
  onSpeed: (s: Speed) => void;
  onReset: () => void;
  live?: boolean;
}

export default function ControlBar(p: Props) {
  return (
    <div className="controls">
      <select aria-label="scenario" value={p.scenarioId ?? ''} onChange={(e) => p.onScenario(e.target.value)}>
        {p.scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {!p.live && (
        <>
          <button className="primary" onClick={p.onPlay}>{p.playing ? 'Pause' : 'Play'}</button>
          {SPEEDS.map((s) => (
            <button key={s} aria-pressed={p.speed === s} onClick={() => p.onSpeed(s)}>{s}h/s</button>
          ))}
          <div className="spacer" />
          <button onClick={p.onReset}>Reset</button>
          <span className="hotkey-hint" aria-hidden="true">space play - 1/2/3 speed</span>
        </>
      )}
    </div>
  );
}
