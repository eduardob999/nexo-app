import { dueText } from './urgency';
import { tripGroups } from './trips';
import { TripTicket } from './TripTicket';
import type { Card } from './types';

function TripRow({ card, now }: { card: Card; now: Date }) {
  return (
    <li className="trip">
      <a className="trip-head" href={`#/card/${card.id}`}>
        <span className="row-title">{card.title ?? card.id}</span>
        <span className="row-meta">{dueText(card, now)}{card.place ? ` · ${card.place}` : ''}</span>
      </a>
      {card.plan ? <TripTicket plan={card.plan} /> : null}
    </li>
  );
}

export function Trips({ cards, now }: { cards: Card[]; now: Date }) {
  const g = tripGroups(cards, now);
  return (
    <main className="screen">
      <header className="top"><div><span className="kicker">{g.soon.length + g.later.length} OPEN</span><h1>Trips</h1></div></header>
      {g.soon.length === 0 ? <p className="empty">{g.later.length ? 'Nothing close. The next trip is under Later.' : 'No trip planned. Tell Nexo about one and it appears here.'}</p> : null}
      <ul className="trips">{g.soon.map((c) => <TripRow key={c.id} card={c} now={now} />)}</ul>
      {g.later.length ? (
        <details className="shelf-fold"><summary>Later <span className="mut">{g.later.length}</span></summary>
          <ul className="trips">{g.later.map((c) => <TripRow key={c.id} card={c} now={now} />)}</ul>
        </details>
      ) : null}
    </main>
  );
}
