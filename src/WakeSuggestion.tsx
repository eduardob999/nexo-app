import { useEffect } from 'react';
import { clock, fullPrefs, suggestWake, ymd, type WakeBasis, type WakeDoc, type WakeFeedback, type WakePrefs, type WakeRecord } from './alarm';
import type { Card } from './types';

interface Props {
  cards: Card[];
  now: Date;
  wake?: WakeDoc | null | undefined;
  onRecord?: ((date: string, rec: WakeRecord) => void) | undefined;
  onAnswer?: ((date: string, rec: WakeRecord, feedback: WakeFeedback, prefs: WakePrefs) => void) | undefined;
}

const WHY: Record<WakeBasis, string> = {
  travel: 'to get ready and travel',
  home: 'to get ready',
  usual: '',
};

/**
 * Evening: tomorrow's recommended wake-up time, from the first timed card and what has been learned about his mornings.
 * Morning: one question about how that wake-up went, which moves the numbers.
 */
export function WakeSuggestion({ cards, now, wake, onRecord, onAnswer }: Props) {
  const prefs = fullPrefs(wake?.prefs);
  const tomorrow = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const today = ymd(now);
  const evening = now.getHours() >= 18;
  const s = suggestWake(cards, now, prefs);
  const rec: WakeRecord = { minutes: s.minutes, basis: s.basis, lead: s.lead, ...(s.first ? { first: s.first.title } : {}) };
  const saved = wake?.log?.[tomorrow];

  useEffect(() => {
    if (!evening || !onRecord || saved?.feedback) return;
    if (saved && saved.minutes === rec.minutes && saved.basis === rec.basis) return;
    onRecord(tomorrow, rec);
  // The record is a function of these values; listing the object itself would re-write it every render.
  }, [evening, tomorrow, rec.minutes, rec.basis, saved?.minutes, saved?.basis, saved?.feedback]); // eslint-disable-line react-hooks/exhaustive-deps

  const asked = wake?.log?.[today];
  const morning = now.getHours() >= 5 && now.getHours() < 18;
  if (morning && asked && !asked.feedback && onAnswer) {
    const answer = (f: WakeFeedback) => onAnswer(today, asked, f, prefs);
    return (
      <section className="wake" aria-label="How the wake-up went">
        <span className="kicker">THIS MORNING</span>
        <p className="wake-q">How was waking up at <b className="mono">{clock(asked.minutes)}</b>?{asked.first ? <span className="mut"> First thing today: {asked.first}</span> : null}</p>
        <div className="wake-answers" role="group" aria-label="Wake-up feedback">
          <button className="chip-btn" onClick={() => answer('early')}>Too early</button>
          <button className="chip-btn" onClick={() => answer('right')}>About right</button>
          <button className="chip-btn" onClick={() => answer('late')}>Too late</button>
        </div>
      </section>
    );
  }
  if (!evening) return null;
  return (
    <section className="wake" aria-label="Recommended wake-up time for tomorrow">
      <span className="kicker">WAKE UP TOMORROW AT</span>
      <b className="wake-big mono">{clock(s.minutes)}</b>
      <p className="mut">
        {s.first
          ? `First: ${clock(s.first.at)} ${s.first.title}${s.first.place ? `, ${s.first.place}` : ''}. ${s.lead} min ${WHY[s.basis]}.`
          : 'Nothing timed tomorrow, so your usual time.'}
      </p>
      <p className="mut">{prefs.n > 0 ? `Adjusted from ${prefs.n} morning${prefs.n === 1 ? '' : 's'} you rated.` : 'I will ask how each morning went and adjust.'}</p>
    </section>
  );
}
