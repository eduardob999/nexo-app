import { useState } from 'react';
import type { Card } from './types';
import { bandOf, dueText } from './urgency';

interface Props {
  cards: Card[];
  now: Date;
  onDone: (card: Card) => void;
}

const DAY = 86_400_000;
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function dueDay(card: Card): string | null {
  if (!card.due) return null;
  const d = card.due.length <= 10 ? new Date(`${card.due}T00:00:00`) : new Date(card.due);
  return Number.isNaN(d.getTime()) ? null : key(d);
}

/**
 * Todoist's Upcoming: a week strip with a dot under each day that has cards,
 * and the list grouped by day. Tapping a day starts the list there.
 */
export function Upcoming({ cards, now, onDone }: Props) {
  const mine = cards.filter((c) => c.for === 'you');
  const [from, setFrom] = useState(key(now));
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  const byDay = new Map<string, Card[]>();
  for (const c of mine) {
    const k = dueDay(c);
    if (k && k >= from) byDay.set(k, [...(byDay.get(k) ?? []), c]);
  }
  const days = [...byDay.keys()].sort();
  const undated = mine.filter((c) => !dueDay(c));
  const label = (k: string) => {
    const d = new Date(`${k}T00:00:00`);
    const diff = Math.round((d.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / DAY);
    const name = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const wk = d.toLocaleDateString('en-GB', { weekday: 'long' });
    return diff === 0 ? `${name} · Today · ${wk}` : diff === 1 ? `${name} · Tomorrow · ${wk}` : `${name} · ${wk}`;
  };

  return (
    <main className="screen">
      <header className="top">
        <div>
          <span className="kicker">{now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase()}</span>
          <h1>Upcoming</h1>
        </div>
      </header>
      <div className="strip" role="group" aria-label="Week">
        {week.map((d) => {
          const k = key(d);
          return (
            <button key={k} className={`day ${k === from ? 'sel' : ''} ${k === key(now) ? 'today' : ''}`} onClick={() => setFrom(k)}
              aria-label={d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}>
              <span className="dow">{d.toLocaleDateString('en-GB', { weekday: 'narrow' })}</span>
              <span className="dom">{d.getDate()}</span>
              <i className={`dot ${[...mine].some((c) => dueDay(c) === k) ? 'has' : ''}`} />
            </button>
          );
        })}
      </div>
      {days.length === 0 && undated.length === 0 ? <p className="empty">Nothing scheduled.</p> : null}
      {days.map((k) => (
        <section key={k} className="day-group">
          <h2 className="day-title">{label(k)}</h2>
          <ul className="rows panel-flat">
            {(byDay.get(k) ?? []).map((c) => (
              <li key={c.id} className={`row band-${bandOf(c, now)}`}>
                <button className="ring" aria-label={`Mark done: ${c.title ?? c.id}`} onClick={() => onDone(c)} />
                <a className="row-main link" href={`#/card/${c.id}`}>
                  <span className="row-title">{c.title ?? c.id}</span>
                  <span className="row-meta">{dueText(c, now)}{c.place ? ` · ${c.place}` : ''}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {undated.length > 0 ? (
        <section className="day-group">
          <h2 className="day-title">No date</h2>
          <ul className="rows panel-flat">
            {undated.map((c) => (
              <li key={c.id} className="row band-later">
                <button className="ring" aria-label={`Mark done: ${c.title ?? c.id}`} onClick={() => onDone(c)} />
                <a className="row-main link" href={`#/card/${c.id}`}><span className="row-title">{c.title ?? c.id}</span></a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
