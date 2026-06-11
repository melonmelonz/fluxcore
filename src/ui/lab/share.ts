export interface LabParams {
  hub: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

const HUB_RE = /^HB_[A-Z]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function encodeLab(p: LabParams): string {
  const q = new URLSearchParams({ hub: p.hub, start: p.start, end: p.end });
  return `#lab?${q.toString()}`;
}

export function decodeLab(hash: string): LabParams | null {
  if (!hash.startsWith('#lab?')) return null;
  const q = new URLSearchParams(hash.slice('#lab?'.length));
  const hub = q.get('hub') ?? '';
  const start = q.get('start') ?? '';
  const end = q.get('end') ?? '';
  if (!HUB_RE.test(hub) || !DATE_RE.test(start) || !DATE_RE.test(end) || start >= end) return null;
  return { hub, start, end };
}
