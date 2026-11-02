import { useState } from 'react';
import type { Card } from './types';
import { bandOf, dueText, sortQueue, type Band } from './urgency';

interface Props {
  cards: Card[];
  now: Date;
  fromCache: boolean;
  onDone: (id: string) => void;
  onCallNexo: () => void;
}

const BAND_LABEL: Record<Band, string> = {
  assignment: 'Assignments',
  now: 'Now',
  today: 'Today',
  later: 'Later',
};

function CardRow({ card, now, onDone }: { card: Card; now: Date; onDone: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const band = bandOf(card, now);
  return (
    <li className={`card band-${band}`}>
      <button className="card-main" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="card-meta">
          {card.type ? <span className="tag">{card.type}</span> : null}
          <span className="due">{dueText(card, now)}</span>
          {card.entryCount ? <span className="count">{card.entryCount}</span> : null}
        </span>
        <span className="title">{card.title ?? card.id}</span>
        {card.last ? (
          <span className="last">
            <b>{card.last.by === 'eduardo' ? 'You' : 'Nexo'}</b> {card.last.text}
          </span>
        ) : null}
        {open && card.place ? <span className="place">{card.place}</span> : null}
      </button>
      <div className="card-actions">
        <button className="act primary" onClick={() => onDone(card.id)}>Done</button>
      </div>
    </li>
  );
}

export function Today({ cards, now, fromCache, onDone, onCallNexo }: Props) {
  const mine = sortQueue(cards.filter((c) => c.for === 'you'), now);
  const groups = (['assignment', 'now', 'today', 'later'] as Band[])
    .map((b) => ({ band: b, items: mine.filter((c) => bandOf(c, now) === b) }))
    .filter((g) => g.items.length > 0);

  return (
    <main className="screen">
      <header className="top">
        <h1>Today</h1>
        <button className="call" onClick={onCallNexo}>Call Nexo</button>
      </header>
      {fromCache ? <p className="notice">Showing saved data. Waiting for the network.</p> : null}
      {groups.length === 0 ? <p className="empty">Nothing needs you.</p> : null}
      {groups.map((g) => (
        <section key={g.band}>
          <h2 className={`band-title band-${g.band}`}>{BAND_LABEL[g.band]} <span>{g.items.length}</span></h2>
          <ul className="cards">
            {g.items.map((c) => <CardRow key={c.id} card={c} now={now} onDone={onDone} />)}
          </ul>
        </section>
      ))}
    </main>
  );
}
