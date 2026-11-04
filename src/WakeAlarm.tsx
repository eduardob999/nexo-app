import { useState } from 'react';
import { alarmLink, clock, DEFAULT_LEAD, suggestWake } from './alarm';
import type { Card } from './types';

const KEY = 'nexo-wake-lead';
const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

function readLead(): number {
  try { const n = Number(localStorage.getItem(KEY)); return n >= 15 && n <= 240 ? n : DEFAULT_LEAD; } catch { return DEFAULT_LEAD; }
}

/** Evening card on Today: tomorrow's recommended wake-up time, with a button that opens the Clock app on it. */
export function WakeAlarm({ cards, now }: { cards: Card[]; now: Date }) {
  const [lead, setLead] = useState(readLead());
  const [shift, setShift] = useState(0);
  if (now.getHours() < 18) return null;
  const s = suggestWake(cards, now, lead);
  const minutes = s.minutes + shift;
  const setLeadSaved = (n: number) => { setLead(n); try { localStorage.setItem(KEY, String(n)); } catch { /* ignore */ } };
  return (
    <section className="wake" aria-label="Wake-up alarm for tomorrow">
      <div className="wake-main">
        <span className="kicker">TOMORROW'S ALARM</span>
        <div className="wake-time">
          <button className="chip-btn small" aria-label="Fifteen minutes earlier" onClick={() => setShift((x) => x - 15)}>-15</button>
          <b className="mono">{clock(minutes)}</b>
          <button className="chip-btn small" aria-label="Fifteen minutes later" onClick={() => setShift((x) => x + 15)}>+15</button>
        </div>
        <p className="mut">{s.first ? `First: ${clock(s.first.at)} ${s.first.title}${s.first.place ? `, ${s.first.place}` : ''}` : 'Nothing timed tomorrow, so the usual time.'}</p>
        <p className="mut">
          Get-ready and travel time {lead} min{' '}
          <button className="chip-btn small" onClick={() => { setLeadSaved(Math.max(15, lead - 15)); setShift(0); }}>less</button>{' '}
          <button className="chip-btn small" onClick={() => { setLeadSaved(Math.min(240, lead + 15)); setShift(0); }}>more</button>
        </p>
      </div>
      {isAndroid ? <a className="act-ink" href={alarmLink(minutes)}>Set alarm</a> : <p className="mut">The Set alarm button appears on Android.</p>}
    </section>
  );
}
