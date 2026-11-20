import { balance } from './burden';
import { askRates, dataQuestions, drifted, maturity } from './adapt';
import { t } from './i18n';
import type { Lang } from './model';
import type { KajiData } from './ui';
import { memberColor, taskName } from './view';

/** One row of beads per person. A bead is one tama while the rows fit; past that each bead is worth 2, 5, 10 and so on, and the note says so. */
function Abacus({ rows }: { rows: { name: string; color: string; burden: number; share: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.burden));
  const W = 330, R = 8.5;
  const fit = Math.floor((W - 40) / (R * 2 + 1.2));
  const per = [1, 2, 5, 10, 20, 50].find((u) => max / u <= fit) ?? 100;
  return (
    <svg className="kaji-abacus" viewBox={`0 0 ${W} ${rows.length * 52 + 22}`} role="img" aria-label={rows.map((r) => `${r.name} ${r.burden.toFixed(1)}`).join(', ')}>
      {rows.map((r, k) => {
        const y = 28 + k * 52;
        const beads = Math.floor(r.burden / per);
        const frac = r.burden / per - beads;
        return (
          <g key={r.name}>
            <line x1="6" x2={W - 6} y1={y} y2={y} stroke="var(--edge)" strokeWidth="2" strokeLinecap="round" />
            {Array.from({ length: beads }, (_, i) => <circle key={i} cx={20 + i * (R * 2 + 1.2)} cy={y} r={R} fill={r.color} />)}
            {frac > 0.05 ? <circle cx={20 + beads * (R * 2 + 1.2)} cy={y} r={R * (0.45 + 0.55 * frac)} fill={r.color} opacity={0.45} /> : null}
            <text x="8" y={y - 14} fontSize="12" fill="var(--muted)">{r.name}  {r.burden.toFixed(1)}</text>
          </g>
        );
      })}
      <text x={W - 8} y={rows.length * 52 + 16} fontSize="11" textAnchor="end" fill="var(--muted)">1 ● = {per} tama</text>
    </svg>
  );
}

export function BalanceScreen({ data, lang }: { data: KajiData; lang: Lang }) {
  const away = Object.fromEntries(data.members.map((m) => [m.uid, Math.max(0, Math.min(data.settings.windowDays, Math.ceil(((data.away[m.uid] ?? 0) - data.now) / 86_400_000)))]));
  const b = balance(data.log, data.tasks, data.estimates, data.members, data.now, data.settings, away);
  const rows = data.members.map((m, i) => ({ name: m.name, color: memberColor(i), burden: b.perUid[m.uid]?.burden ?? 0, share: b.target[m.uid] ?? 0 }));
  const lead = [...data.members].sort((x, y) => (b.diff[y.uid] ?? 0) - (b.diff[x.uid] ?? 0))[0];
  const gap = lead ? b.diff[lead.uid] ?? 0 : 0;
  const pct = Math.round(b.evenness * 100);
  const byId = new Map(data.tasks.map((x) => [x.id, x]));
  const learning = data.tasks.filter((x) => x.active && !x.freq.adhoc && x.mode === 'measured').map((x) => {
    const est = data.estimates[x.id];
    const mat = est ? maturity(est, x, data.log, data.now) : 'new';
    return { x, est, mat, rate: askRates(mat, drifted(data.log, x.id), x, data.settings).timer };
  });
  return (
    <>
      <div className="panel kaji-bal">
        <div className="kaji-bal-head"><span className="kicker">{t(lang, 'window28').toUpperCase()}</span><b className="kaji-pct" aria-label={t(lang, 'evenness')}>{b.total ? `${pct}%` : '–'}</b></div>
        <Abacus rows={rows} />
        <p className="mut kaji-line">{b.total === 0 ? t(lang, 'even') : Math.abs(gap) < 1 ? t(lang, 'even') : `${lead?.name} ${t(lang, 'ahead')} +${gap.toFixed(1)} ${t(lang, 'tama')}`}</p>
        <div className="kaji-cols">
          {data.members.map((m, i) => (
            <div key={m.uid}><i className="kaji-dot" style={{ background: memberColor(i) }} /> <b>{m.name}</b>
              <small className="mut">{Math.round((b.perUid[m.uid]?.minutes ?? 0))} {t(lang, 'minutes')} · {t(lang, 'credit')} {(b.perUid[m.uid]?.credit ?? 0).toFixed(1)}</small></div>
          ))}
        </div>
      </div>
      <h2 className="group-title">{t(lang, 'dataQuestions')}</h2>
      <div className="panel kaji-bal">
        <b className="kaji-pct">{dataQuestions(data.log, data.now)}</b>
        <ul className="kaji-learn">
          {learning.slice(0, 12).map(({ x, est, mat, rate }) => (
            <li key={x.id}><span>{x.icon} {taskName(byId.get(x.id), lang)}</span>
              <small className="mut">{est && est.n ? `${Math.round(est.meanMin)} ${t(lang, 'minutes')} · n=${est.n}` : `~${x.priorMinutes} ${t(lang, 'minutes')}`} · {mat} · {Math.round(rate * 100)}%</small></li>
          ))}
        </ul>
      </div>
    </>
  );
}
