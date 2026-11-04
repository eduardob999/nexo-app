import { useEffect, useState } from 'react';
import { clock, DEFAULT_LEAD, suggestWake, wakeDate, type AlarmDoc } from './alarm';
import { pushState, type PushState } from './push';
import type { Card } from './types';

const KEY = 'nexo-wake-lead';

function readLead(): number {
  try { const n = Number(localStorage.getItem(KEY)); return n >= 15 && n <= 240 ? n : DEFAULT_LEAD; } catch { return DEFAULT_LEAD; }
}

interface Props { cards: Card[]; now: Date; alarm?: AlarmDoc | null | undefined; onSet?: ((at: Date) => void) | undefined; onCancel?: (() => void) | undefined }

function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${clock(d.getHours() * 60 + d.getMinutes())}`;
}

/** Evening card on Today: tomorrow's recommended wake-up time and a button that has Nexo push a loud notification then. */
export function WakeAlarm({ cards, now, alarm, onSet, onCancel }: Props) {
  const [lead, setLead] = useState(readLead());
  const [shift, setShift] = useState(0);
  const [push, setPush] = useState<PushState>('off');
  useEffect(() => { void pushState().then(setPush); }, []);
  const live = alarm?.status === 'set' && new Date(alarm.at).getTime() > now.getTime() - 20 * 60_000 ? alarm : null;
  if (now.getHours() < 18 && !live) return null;
  const s = suggestWake(cards, now, lead);
  const minutes = s.minutes + shift;
  const setLeadSaved = (n: number) => { setLead(n); try { localStorage.setItem(KEY, String(n)); } catch { /* ignore */ } };
  return (
    <section className="wake" aria-label="Wake-up alarm for tomorrow">
      <div className="wake-main">
        <span className="kicker">{live ? 'ALARM SET' : "TOMORROW'S ALARM"}</span>
        {live ? (
          <div className="wake-time"><b className="mono">{when(live.at)}</b></div>
        ) : (
          <div className="wake-time">
            <button className="chip-btn small" aria-label="Fifteen minutes earlier" onClick={() => setShift((x) => x - 15)}>-15</button>
            <b className="mono">{clock(minutes)}</b>
            <button className="chip-btn small" aria-label="Fifteen minutes later" onClick={() => setShift((x) => x + 15)}>+15</button>
          </div>
        )}
        <p className="mut">{s.first ? `First: ${clock(s.first.at)} ${s.first.title}${s.first.place ? `, ${s.first.place}` : ''}` : 'Nothing timed tomorrow, so the usual time.'}</p>
        {live ? null : (
          <p className="mut">
            Get-ready and travel time {lead} min{' '}
            <button className="chip-btn small" onClick={() => { setLeadSaved(Math.max(15, lead - 15)); setShift(0); }}>less</button>{' '}
            <button className="chip-btn small" onClick={() => { setLeadSaved(Math.min(240, lead + 15)); setShift(0); }}>more</button>
          </p>
        )}
      </div>
      {live ? (
        <button className="chip-btn" onClick={onCancel}>Cancel alarm</button>
      ) : push === 'on' ? (
        <button className="act-ink" onClick={() => onSet?.(wakeDate(minutes, now))}>Wake me at {clock(minutes)}</button>
      ) : (
        <p className="mut">Turn on notifications in Browse first, so Nexo can wake you.</p>
      )}
      <p className="mut">Nexo sends a loud notification that repeats for 10 minutes. It needs your computer on and the phone not on silent. Keep your normal alarm as the safety net.</p>
    </section>
  );
}
