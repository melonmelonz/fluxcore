import type { Speed } from '../useSimulation';

interface Props {
  scenarios: { id: string; name: string }[];
  scenarioId: string | null;
  onScenario: (id: string) => void;
  playing: boolean;
  onPlay: () => void;
  speed: Speed;
  onSpeed: (s: Speed) => void;
  onReset: () => void;
}

export default function ControlBar(_props: Props) {
  return <div className="controls" />;
}
