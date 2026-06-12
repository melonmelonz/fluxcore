import { SPEEDS, type Speed } from '../useSimulation';

const SPEED_KEYS = ['1', '2', '3'];
const SPEED_LABELS = ['1h/s', '6h/s', '24h/s'];

interface Props {
  scenarios: { id: string; name: string }[];
  scenarioId: string | null;
  onScenario: (id: string) => void;
  playing: boolean;
  onPlay: () => void;
  speed: Speed;
  onSpeed: (s: Speed) => void;
  onStep: (dir: 1 | -1) => void;
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
          <div className="transport" role="group" aria-label="transport">
            <button className="ctl tip" data-tip="step back  &#8592;" aria-label="step back one tick" onClick={() => p.onStep(-1)}>&#8249;</button>
            {/* key remount re-runs the pop animation on every state flip, mouse or hotkey */}
            <button key={p.playing ? 'pause' : 'play'} className={`ctl play tip pop${p.playing ? ' on' : ''}`} data-tip="play / pause  space" onClick={p.onPlay}>
              <span className="glyph">{p.playing ? '\u275A\u275A' : '\u25B6'}</span>
              {p.playing ? 'Pause' : 'Play'}
            </button>
            <button className="ctl tip" data-tip="step forward  &#8594;" aria-label="step forward one tick" onClick={() => p.onStep(1)}>&#8250;</button>
          </div>
          <div className="seg" role="group" aria-label="replay speed">
            {SPEEDS.map((s, i) => (
              <button
                key={`${s}:${p.speed === s}`}
                className={`tip${p.speed === s ? ' active pop' : ''}`}
                data-tip={`speed  ${SPEED_KEYS[i]}`}
                aria-pressed={p.speed === s}
                onClick={() => p.onSpeed(s)}
              >
                {SPEED_LABELS[i]}
              </button>
            ))}
          </div>
          <div className="spacer" />
          <button className="ctl tip" data-tip="back to start" onClick={p.onReset}>Reset</button>
          <span className="hotkey-hint" aria-hidden="true">
            <kbd>space</kbd> play <kbd>&#8592;</kbd><kbd>&#8594;</kbd> step <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> speed
          </span>
        </>
      )}
    </div>
  );
}
