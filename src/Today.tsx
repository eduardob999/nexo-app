import { useState } from 'react';
import type { Card } from './types';
import { bandOf, dueText, sortQueue, type Band } from './urgency';

interface Props {
  cards: Card[];
  now: Date;
  fromCache: boolean;
  onDone: (card: Card) => void;
  onLater: (card: Card) => void;
  onCallNexo: () => void;
}

const BAND_LABEL: Record<Band, string> = { assignment: 'Assignments', now: 'Now', today: 'Today', later: 'Later' };
const BANDS: Band[] = ['assignment', 'now', 'today', 'later'];

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" />
    </svg>
  );
}

function Row({ card, now, onDone, onLater }: { card: Card; now: Date; onDone: Props['onDone']; onLater: Props['onLater'] }) {
  const [open, setOpen] = useState(false);
  const band = bandOf(card, now);
  const title = card.title ?? card.id;
  return (
    <li className={`row band-${band}`}>
      <button className="ring" aria-label={`Mark done: ${title}`} onClick={() => onDone(card)} />
      <div className="row-body">
        <button className="row-main" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="row-title">{title}</span>
          {card.last ? (
            <span className="row-last"><b>{card.last.by === 'eduardo' ? 'You' : 'Nexo'}</b> {card.last.text}</span>
          ) : null}
          <span className="row-meta"><CalendarIcon />{dueText(card, now)}{card.place ? ` · ${card.place}` : ''}</span>
        </button>
        {open ? (
          <div className="row-actions">
            <button className="chip-btn" onClick={() => onLater(card)}>Later</button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function Today({ cards, now, fromCache, onDone, onLater, onCallNexo }: Props) {
  const mine = sortQueue(cards.filter((c) => c.for === 'you'), now);
  const groups = BANDS.map((b) => ({ band: b, items: mine.filter((c) => bandOf(c, now) === b) })).filter((g) => g.items.length > 0);
  const stamp = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();

  return (
    <main className="screen">
      <header className="top">
        <div>
          <span className="kicker">{stamp} · {mine.length} LEFT</span>
          <h1>Today</h1>
        </div>
        <button className="call" onClick={onCallNexo}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
          Call Nexo
        </button>
      </header>
      {fromCache ? <p className="notice">Showing saved data. Waiting for the network.</p> : null}
      {groups.length === 0 ? <p className="empty">Nothing needs you.</p> : (
        <div className="panel">
          {groups.map((g) => (
            <section key={g.band}>
              <h2 className={`band-title band-${g.band}`}>{BAND_LABEL[g.band]}</h2>
              <ul className="rows">
                {g.items.map((c) => <Row key={c.id} card={c} now={now} onDone={onDone} onLater={onLater} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
