import { useState } from 'react';
import { searchCards } from './search';
import type { Card } from './types';
import { dueText } from './urgency';

export function Search({ cards, now }: { cards: Card[]; now: Date }) {
  const [q, setQ] = useState('');
  const hits = searchCards(cards, q);
  return (
    <main className="screen">
      <header className="top"><div><span className="kicker">OPEN CARDS</span><h1>Search</h1></div></header>
      <label className="sr" htmlFor="q">Search cards</label>
      <input id="q" className="search-input" type="search" autoFocus placeholder="Title, place or last message" value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim() && hits.length === 0 ? <p className="empty">No open card matches.</p> : null}
      {hits.length > 0 ? (
        <ul className="rows panel-flat search-results">
          {hits.map((c) => (
            <li key={c.id} className="row band-later">
              <a className="row-main link" href={`#/card/${c.id}`}>
                <span className="row-title">{c.title ?? c.id}</span>
                <span className="row-meta">{dueText(c, now)}{c.for === 'nexo' ? ' · with Nexo' : ''}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
