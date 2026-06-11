export default function StormBadge({ storm }: { storm: boolean }) {
  if (!storm) return null;
  return <span className="live-badge storm-on" role="status">STORM</span>;
}
