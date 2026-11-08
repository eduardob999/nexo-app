import { useState } from 'react';
import { clock, fullPrefs, ymd, type WakeDoc } from './alarm';
import { RestSheet } from './RestSheet';
import { newestFirst, restStats, type RestRec } from './restmodel';
import { Face } from './SleepFeedback';
import { addDays, bars, factorEffects, fmtHours, hhmm, planSleep, sleepStats, type SleepRec } from './sleepmodel';
import type { Card } from './types';

interface RestActions {
  onMark: (date: string, kind: 'full' | 'light') => void;
  onUndo: (date: string) => void;
  onRate: (date: string, patch: { wellbeing?: number | null; performance?: number | null; activities?: Record<string, boolean>; note?: string }) => void;
}
interface Props { recs: SleepRec[]; cards: Card[]; now: Date; wake?: WakeDoc | null | undefined; rest?: RestRec[] | undefined; restActions?: RestActions | undefined }

const AXIS = ['20', '00', '04', '08', '12'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function label(night: string): string {
  const [y, m, d] = night.split('-').map(Number) as [number, number, number];
  return `${DAYS[new Date(y, m - 1, d).getDay()]} ${d}`;
}

/** Browse > Sleep: the last 14 nights, what they add up to, and what tonight should look like. */
export function SleepScreen({ recs, cards, now, wake, rest = [], restActions }: Props) {
  const [rateSheet, setRateSheet] = useState<{ date: string; ask: 'wellbeing' | 'performance' } | null>(null);
  const plan = planSleep({ recs, cards, now, prefs: fullPrefs(wake?.prefs) });
  const lastNight = now.getHours() >= 12 ? ymd(now) : addDays(ymd(now), -1);
  const chart = bars(recs, lastNight, 14);
  const st = sleepStats(recs, lastNight);
  const fx = factorEffects(recs);
  const known = fx.filter((f) => f.verdict !== 'unknown');
  const bad = st.avgHours !== null && st.avgHours < plan.needHours - 0.25;
  return (
    <main className="screen">
      <header className="top"><div><span className="kicker">{recs.length} NIGHT{recs.length === 1 ? '' : 'S'} RECORDED</span><h1>Sleep</h1></div></header>

      <section className="sleep-suggest" aria-label="Tonight's suggestion">
        <span className="kicker">{plan.confidence.toUpperCase()} CONFIDENCE</span>
        <p>Wind down <b className="mono">{hhmm(plan.windDownAt)}</b>, bed <b className="mono">{hhmm(plan.bedAt)}</b>, up <b className="mono">{clock(plan.wakeAt.getHours() * 60 + plan.wakeAt.getMinutes())}</b>.</p>
        <p className="mut">{plan.reason}</p>
        {plan.first ? <p className="mut">First thing: {clock(plan.first.at)} {plan.first.title}.</p> : null}
      </section>

      <h2 className="group-title">Last 14 nights</h2>
      <div className="panel sleep-bars" role="img" aria-label="Bedtime to wake time for the last 14 nights">
        <div className="sleep-axis" aria-hidden="true">{AXIS.map((a) => <span key={a}>{a}</span>)}</div>
        {chart.map((b) => (
          <div className="sleep-row" key={b.night}>
            <small>{label(b.night)}</small>
            <div className="sleep-track">
              {b.start !== undefined && b.end !== undefined ? (
                <span className={`sleep-bar ${b.rec?.rating ? `r${b.rec.rating >= 4 ? 4 : b.rec.rating <= 1 ? 1 : b.rec.rating <= 2 ? 2 : 3}` : ''}`} style={{ left: `${b.start * 100}%`, width: `${Math.max(1.5, (b.end - b.start) * 100)}%` }} />
              ) : b.rec ? <span className="sleep-bar open" style={{ left: `${axisLeft(b.rec)}%`, width: '6%' }} /> : null}
            </div>
          </div>
        ))}
      </div>
      <p className="notice">Green nights felt good, orange and red felt poor, blue are not rated yet.</p>

      {st.nights === 0 ? <p className="empty">No nights yet. Tap Go to bed on Today tonight.</p> : (
        <ul className="sleep-stats">
          <li><b>{st.avgHours !== null ? fmtHours(st.avgHours) : 'n/a'}</b><small>Average sleep{bad ? ', below your need' : ''}</small></li>
          <li><b>{st.avgBed ?? 'n/a'} / {st.avgWake ?? 'n/a'}</b><small>Average bed and up</small></li>
          <li><b>{st.consistency ?? 'n/a'}</b><small>{st.bedSpreadMin !== null ? `Bedtime varies by about ${st.bedSpreadMin} min` : 'Consistency needs 3 nights'}</small></li>
          <li><b>{plan.debtHours > 0 ? fmtHours(plan.debtHours) : 'none'}</b><small>Sleep debt, last 7 nights</small></li>
          <li><b>{st.bestHours !== null ? fmtHours(st.bestHours) : 'n/a'}</b><small>{st.bestHours !== null ? 'Best rated duration' : 'Best rated duration: not enough nights yet'}</small></li>
          <li><b className="face-line">{st.avgRating !== null ? <><Face v={Math.round(st.avgRating)} size={24} /> {st.avgRating.toFixed(1)}</> : 'n/a'}</b><small>Average rating</small></li>
        </ul>
      )}

      <h2 className="group-title">What helps and what hurts</h2>
      {known.length === 0 ? <p className="notice">Not enough nights yet. A factor shows here once it has 3 nights with it and 3 without it.</p> : (
        <div className="panel"><ul className="factor-list">
          {known.map((f) => (
            <li key={f.key}><span>{f.label}</span><span className={f.verdict}>{f.verdict === 'none' ? 'no clear effect' : `${f.verdict}, ${f.diff! > 0 ? '+' : ''}${f.diff} rating`}</span></li>
          ))}
        </ul></div>
      )}
      {fx.some((f) => f.verdict === 'unknown') && known.length > 0 ? <p className="notice">Other factors need 3 nights with and without before they are compared.</p> : null}

      <h2 className="group-title">Rest</h2>
      <RestSection rest={rest} now={now} actions={restActions} onRate={(date, ask) => setRateSheet({ date, ask })} />
      {rateSheet && restActions ? (() => {
        const r = rest.find((x) => x.date === rateSheet.date);
        return r ? <RestSheet rec={r} ask={rateSheet.ask} onClose={() => setRateSheet(null)} onSave={(patch) => { restActions.onRate(r.date, patch); setRateSheet(null); }} /> : null;
      })() : null}
    </main>
  );
}

function RestSection({ rest, now, actions, onRate }: { rest: RestRec[]; now: Date; actions: RestActions | undefined; onRate: (date: string, ask: 'wellbeing' | 'performance') => void }) {
  const today = ymd(now);
  const yesterday = addDays(today, -1);
  const st = restStats(rest);
  const markedToday = rest.find((r) => r.date === today);
  const markedYesterday = rest.find((r) => r.date === yesterday);
  return (
    <>
      {actions ? (
        <div className="sleep-opts">
          {markedToday ? (
            <button className="chip-btn" onClick={() => actions.onUndo(today)}>Today: {markedToday.kind} rest. Undo<small>You are asked how you feel this evening.</small></button>
          ) : (
            <>
              <button className="chip-btn" onClick={() => actions.onMark(today, 'full')}>Full rest today<small>Nothing planned, nothing owed.</small></button>
              <button className="chip-btn" onClick={() => actions.onMark(today, 'light')}>Light rest today<small>Slow day, a few small things.</small></button>
            </>
          )}
          {!markedYesterday ? <button className="chip-btn" onClick={() => actions.onMark(yesterday, 'full')}>Yesterday was a rest day<small>Add it after the fact.</small></button> : null}
        </div>
      ) : null}
      {st.days === 0 ? <p className="empty">No rest days recorded yet. Mark one above and you are asked how you feel that evening and how the day after goes.</p> : (
        <>
          <ul className="sleep-stats">
            <li><b>{st.days}</b><small>Rest days ({st.full} full)</small></li>
            <li><b className="face-line">{st.avgWellbeing !== null ? <><Face v={Math.round(st.avgWellbeing)} size={24} /> {st.avgWellbeing.toFixed(1)}</> : 'n/a'}</b><small>Average wellbeing</small></li>
            <li><b className="face-line">{st.avgPerformance !== null ? <><Face v={Math.round(st.avgPerformance)} size={24} /> {st.avgPerformance.toFixed(1)}</> : 'n/a'}</b><small>Average performance the day after</small></li>
          </ul>
          <div className="panel"><ul className="factor-list">
            {newestFirst(rest).slice(0, 14).map((r) => (
              <li key={r.date}>
                <span>{label(r.date)}, {r.kind}</span>
                <span className="face-line">
                  {r.wellbeing !== null ? <><Face v={r.wellbeing} size={20} /> feel</> : actions ? <button className="chip-btn small" onClick={() => onRate(r.date, 'wellbeing')}>Rate feeling</button> : 'not rated'}
                  {' '}
                  {r.performance !== null ? <><Face v={r.performance} size={20} /> next day</> : actions && r.date < today ? <button className="chip-btn small" onClick={() => onRate(r.date, 'performance')}>Rate next day</button> : null}
                </span>
              </li>
            ))}
          </ul></div>
        </>
      )}
    </>
  );
}

function axisLeft(r: SleepRec): number {
  const d = new Date(r.bed);
  const m = (d.getHours() * 60 + d.getMinutes() - 20 * 60 + 1440) % 1440;
  return Math.min(94, (m / 960) * 100);
}
