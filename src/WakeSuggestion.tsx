import { useEffect, useMemo, useRef, useState } from 'react';
import { clock, fullPrefs, suggestWake, ymd, type WakeDoc, type WakeFeedback, type WakePrefs, type WakeRecord } from './alarm';
import { SleepFeedback } from './SleepFeedback';
import { fmtHours, hhmm, isMorning, phaseOf, planDoc, planSleep, durationHours, type SleepPlan, type SleepRec } from './sleepmodel';
import type { Card } from './types';

interface Props {
  cards: Card[];
  now: Date;
  wake?: WakeDoc | null | undefined;
  onRecord?: ((date: string, rec: WakeRecord) => void) | undefined;
  onAnswer?: ((date: string, rec: WakeRecord, feedback: WakeFeedback, prefs: WakePrefs) => void) | undefined;
  sleep?: SleepRec[] | undefined;
  onGoToBed?: (() => void) | undefined;
  onUndoBed?: ((night: string) => void) | undefined;
  onImUp?: ((night: string) => void) | undefined;
  onRate?: ((night: string, rating: number | null, factors: Record<string, boolean | number>, note: string) => void) | undefined;
  onEditTimes?: ((night: string, times: { bed?: [number, number]; wake?: [number, number] | null }) => void) | undefined;
  onPlan?: ((plan: SleepPlan) => void) | undefined;
  /** Preview only: open the feedback sheet or the time editor at once. */
  startOpen?: 'feedback' | 'edit' | undefined;
}

const WHY = { travel: 'to get ready and travel', home: 'to get ready', usual: '' } as const;

function EditTimes({ rec, onSave, onClose }: { rec: SleepRec; onSave: (t: { bed: [number, number]; wake: [number, number] | null }) => void; onClose: () => void }) {
  const [bed, setBed] = useState(hhmm(new Date(rec.bed)));
  const [up, setUp] = useState(rec.wake ? hhmm(new Date(rec.wake)) : '');
  const split = (s: string): [number, number] => [Number(s.slice(0, 2)), Number(s.slice(3, 5))];
  return (
    <form className="sleep-edit" onSubmit={(e) => { e.preventDefault(); onSave({ bed: split(bed), wake: up ? split(up) : null }); onClose(); }}>
      <label>Bed<input type="time" value={bed} onChange={(e) => setBed(e.target.value)} required /></label>
      <label>Up<input type="time" value={up} onChange={(e) => setUp(e.target.value)} /></label>
      <button type="submit" className="chip-btn small">Save</button>
      <button type="button" className="chip-btn small" onClick={onClose}>Cancel</button>
    </form>
  );
}

/**
 * The sleep card on Today. Evening: the plan for tonight and a Go to bed button. After the button: Good night, and in the
 * morning I'm up, which opens the one feedback sheet. Without a record it keeps the old wake-up suggestion for tomorrow.
 */
export function WakeSuggestion({ cards, now, wake, onRecord, onAnswer, sleep = [], onGoToBed, onUndoBed, onImUp, onRate, onEditTimes, onPlan, startOpen }: Props) {
  const prefs = fullPrefs(wake?.prefs);
  const tomorrow = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const phase = phaseOf(sleep, now);
  const evening = now.getHours() >= 18;
  const s = suggestWake(cards, now, prefs);
  const rec: WakeRecord = { minutes: s.minutes, basis: s.basis, lead: s.lead, ...(s.first ? { first: s.first.title } : {}) };
  const saved = wake?.log?.[tomorrow];
  const [sheet, setSheet] = useState(startOpen === 'feedback');
  const [editing, setEditing] = useState(startOpen === 'edit');

  const plan = useMemo(() => planSleep({ recs: sleep, cards, now, prefs }), [sleep, cards, now.getHours(), now.getDate(), wake?.prefs?.usual, wake?.prefs?.leadTravel, wake?.prefs?.leadHome]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!evening || !onRecord || saved?.feedback) return;
    if (saved && saved.minutes === rec.minutes && saved.basis === rec.basis) return;
    onRecord(tomorrow, rec);
  // The record is a function of these values; listing the object itself would re-write it every render.
  }, [evening, tomorrow, rec.minutes, rec.basis, saved?.minutes, saved?.basis, saved?.feedback]); // eslint-disable-line react-hooks/exhaustive-deps

  // The sync reads this to send the bedtime reminder. Written when the plan changes, after a pause so typing a record does not spam it.
  const lastPlan = useRef('');
  const key = JSON.stringify(planDoc(plan));
  useEffect(() => {
    if (!onPlan || (phase.kind !== 'evening' && phase.kind !== 'asleep')) return undefined;
    if (key === lastPlan.current) return undefined;
    const t = window.setTimeout(() => { lastPlan.current = key; onPlan(plan); }, 1500);
    return () => window.clearTimeout(t);
  }, [key, phase.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (r: SleepRec) => (editing && onEditTimes ? <EditTimes rec={r} onSave={(t) => onEditTimes(r.night, t)} onClose={() => setEditing(false)} /> : null);
  const editLink = () => (onEditTimes && !editing ? <button className="linkish" onClick={() => setEditing(true)}>Edit times</button> : null);

  if (phase.kind === 'asleep') {
    const r = phase.rec;
    const morning = isMorning(r, now);
    return (
      <section className="wake sleepcard" aria-label="Sleep">
        {morning ? (
          <>
            <span className="kicker">GOOD MORNING</span>
            <p className="wake-q">Bed was <b className="mono">{hhmm(new Date(r.bed))}</b>.<span className="mut"> Tap when you are up to record the night.</span></p>
            <button className="copy-main big" onClick={() => { onImUp?.(r.night); setSheet(true); }}>I'm up</button>
          </>
        ) : (
          <>
            <span className="kicker">GOOD NIGHT</span>
            <p className="wake-q">Good night. Bed <b className="mono">{hhmm(new Date(r.bed))}</b>. Suggested wake <b className="mono">{hhmm(plan.wakeAt)}</b>.<span className="mut">{plan.reason}</span></p>
            <div className="sleep-links">{onUndoBed ? <button className="chip-btn small" onClick={() => onUndoBed(r.night)}>Undo</button> : null}{editLink()}</div>
          </>
        )}
        {morning ? <div className="sleep-links">{editLink()}</div> : null}
        {edit(r)}
        {sheet && onRate ? <SleepFeedback rec={{ ...r, wake: r.wake ?? new Date().toISOString() }} wakeLog={wake?.log?.[ymd(now)]} onClose={() => setSheet(false)} onSave={(rating, f, n, fb) => { onRate(r.night, rating, f, n); if (fb && onAnswer) { const wr = wake?.log?.[ymd(now)]; if (wr) onAnswer(ymd(now), wr, fb, prefs); } setSheet(false); }} /> : null}
      </section>
    );
  }

  if (phase.kind === 'rate') {
    const r = phase.rec;
    const dur = durationHours(r);
    return (
      <section className="wake sleepcard" aria-label="Rate last night">
        <span className="kicker">LAST NIGHT</span>
        <p className="wake-q">{dur !== null ? <>You slept <b className="mono">{fmtHours(dur)}</b>.</> : 'Night recorded.'}<span className="mut">Bed {hhmm(new Date(r.bed))}, up {r.wake ? hhmm(new Date(r.wake)) : 'not recorded'}. How rested do you feel?</span></p>
        <button className="copy-main big" onClick={() => setSheet(true)}>Rate your sleep</button>
        <div className="sleep-links">{editLink()}</div>
        {edit(r)}
        {sheet && onRate ? <SleepFeedback rec={r} wakeLog={wake?.log?.[ymd(now)]} onClose={() => setSheet(false)} onSave={(rating, f, n, fb) => { onRate(r.night, rating, f, n); if (fb && onAnswer) { const wr = wake?.log?.[ymd(now)]; if (wr) onAnswer(ymd(now), wr, fb, prefs); } setSheet(false); }} /> : null}
      </section>
    );
  }

  if (!evening) return null;
  return (
    <section className="wake sleepcard" aria-label="Tonight">
      <span className="kicker">TONIGHT</span>
      <p className="wake-q">Bed by <b className="mono">{hhmm(plan.bedAt)}</b>, up at <b className="mono">{clock(plan.wakeAt.getHours() * 60 + plan.wakeAt.getMinutes())}</b>.
        <span className="mut">
          {plan.first ? `First: ${clock(plan.first.at)} ${plan.first.title}${plan.first.place ? `, ${plan.first.place}` : ''}. ${s.lead} min ${WHY[plan.basis]}.` : 'Nothing timed tomorrow, so your usual time.'}
        </span>
        <span className="mut">{plan.reason}</span>
      </p>
      {onGoToBed ? <button className="copy-main big" onClick={onGoToBed}>Go to bed</button> : null}
    </section>
  );
}
