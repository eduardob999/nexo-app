import { useState } from 'react';
import type { Card } from './types';
import { shareSummary, shareTargets, type Shared } from './share';

interface Props {
  shared: Shared;
  cards: Card[];
  busy: string;
  onNew: () => void;
  onAttach: (card: Card) => void;
  onClose: () => void;
}

/** Where a share from another app goes: onto a new card, or onto one that already exists. */
export function ShareSheet({ shared, cards, busy, onNew, onAttach, onClose }: Props) {
  const [q, setQ] = useState('');
  const list = shareTargets(cards, q);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet share-sheet" role="dialog" aria-label="Share to Nexo" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <p className="share-what">Shared: {shareSummary(shared)}</p>
        <button type="button" className="chip-btn share-new" disabled={!!busy} onClick={onNew}>New card with this</button>
        <label className="sr" htmlFor="share-q">Search cards</label>
        <input id="share-q" className="relay-answer" type="search" placeholder="Or attach to a card: search" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="share-list" aria-label="Cards">
          {list.map((c) => (
            <li key={c.id}>
              <button type="button" disabled={!!busy} onClick={() => onAttach(c)}>
                <span>{c.title ?? c.id}</span>
                {c.type ? <small>{c.type}</small> : null}
              </button>
            </li>
          ))}
          {list.length === 0 ? <li className="mut">No card matches</li> : null}
        </ul>
        {busy ? <p className="mut" role="status">{busy}</p> : null}
        <div className="sheet-foot"><button type="button" className="chip-btn" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}
