import { sunTimes, UJI } from './sky';

const MIN = 60_000;

/** The day as an arc: where the sun is, and a dot for the next thing on the list, so the background carries information. */
export function SunArc({ now, next }: { now: number; next?: { at: number; label: string } | undefined }) {
  const t = sunTimes(now);
  const span = t.set - t.rise;
  const pos = (ms: number) => Math.max(0, Math.min(1, (ms - t.rise) / span));
  const pt = (f: number) => ({ x: 10 + f * 280, y: 56 - Math.sin(Math.PI * f) * 44 });
  const sun = pt(pos(now));
  const night = now < t.rise || now > t.set;
  const nx = next && next.at > now && next.at - now < 20 * 3_600_000 ? pt(pos(next.at)) : null;
  const hhmm = (ms: number) => { const d = new Date(ms + UJI.tz * MIN); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
  return (
    <div className="sunarc" role="img" aria-label={`Sunrise ${hhmm(t.rise)}, sunset ${hhmm(t.set)}${next ? `, next: ${next.label} ${hhmm(next.at)}` : ''}`}>
      <svg viewBox="0 0 300 70" width="100%" height="70">
        <path d="M10 56 Q150 -32 290 56" fill="none" stroke="var(--edge)" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 5" />
        <line x1="6" x2="294" y1="57" y2="57" stroke="var(--edge)" strokeWidth="1" />
        {!night ? <circle cx={sun.x} cy={sun.y} r="7" fill="#f0b33c" /> : <circle cx={pt(pos(now < t.rise ? t.rise : t.set)).x} cy="56" r="4" fill="var(--muted)" />}
        {nx ? <><circle cx={nx.x} cy={nx.y} r="4.5" fill="var(--accent)" /><text x={Math.min(262, Math.max(8, nx.x - 14))} y={Math.max(12, nx.y - 9)} fontSize="11" fill="var(--ink)">{hhmm(next!.at)}</text></> : null}
        <text x="8" y="68" fontSize="10.5" fill="var(--muted)">{hhmm(t.rise)}</text>
        <text x="292" y="68" fontSize="10.5" fill="var(--muted)" textAnchor="end">{hhmm(t.set)}</text>
      </svg>
    </div>
  );
}
