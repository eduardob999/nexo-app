import { useState } from 'react';
import { ConfirmButton } from './ConfirmButton';
import type { Card } from './types';

interface Props {
  card: Card;
  onBring: (index: number, got: boolean) => void;
  onItem: (itemId: string, done: boolean) => void;
  onAdd: (text: string) => void;
  onRemove?: ((itemId: string) => void) | undefined;
}

/** "Bring" on a dated card, "Steps" otherwise, unless the card names its own heading. */
export function bringLabel(card: Card): string {
  return card.bringAs || (card.due ? 'Bring' : 'Steps');
}

function Bar({ done, total }: { done: number; total: number }) {
  return <span className="bbar" aria-hidden="true"><i style={{ width: `${total ? Math.round((done * 100) / total) : 0}%` }} /></span>;
}

/**
 * The two checklists a card can carry. Ticking all of "Bring" reads as finished and closes nothing: closing
 * stays a deliberate act. `items` is a free list that can grow in the shop aisle, so it has its own add row.
 */
export function Checklists({ card, onBring, onItem, onAdd, onRemove }: Props) {
  const [text, setText] = useState('');
  const bring = card.bring ?? [];
  const items = Array.isArray(card.items) ? card.items.filter((x) => !x.deleted) : null;
  const bringDone = bring.filter((b) => b.got).length;
  const itemsDone = (items ?? []).filter((x) => x.done).length;
  const [started, setStarted] = useState(false);
  // A card with no list yet offers to start one; the first item added creates it.
  if (bring.length === 0 && items === null && !started) {
    return card.status === 'open' ? <button type="button" className="chip-btn add-cl" onClick={() => setStarted(true)}>Add checklist</button> : null;
  }
  return (
    <>
      {bring.length > 0 ? (
        <details className={`bring ${bringDone === bring.length ? 'full' : ''}`} open={bringDone !== bring.length}>
          <summary><span className="blabel">{bringLabel(card)}</span><span className="bcount">{bringDone} of {bring.length}</span><Bar done={bringDone} total={bring.length} /></summary>
          <ul className="clist">
            {bring.map((b, i) => (
              <li key={i} className={b.got ? 'citem done' : 'citem'}>
                <label><input type="checkbox" checked={Boolean(b.got)} onChange={(e) => onBring(i, e.target.checked)} /><span>{b.t}</span></label>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {items !== null || started ? (
        <div className="checklist">
          {(items ?? []).length > 0 ? (
            <>
              <div className="clhead"><span className="blabel">Checklist</span><span className="bcount">{itemsDone}/{(items ?? []).length}</span><Bar done={itemsDone} total={(items ?? []).length} /></div>
              <ul className="clist">
                {(items ?? []).map((x) => (
                  <li key={x.id} className={x.done ? 'citem done' : 'citem'}>
                    <label><input type="checkbox" checked={Boolean(x.done)} onChange={(e) => onItem(x.id, e.target.checked)} /><span>{x.text}</span></label>
                    {onRemove ? <ConfirmButton label="×" armedLabel="Remove?" ariaLabel={`Remove ${x.text}`} className="item-x" onConfirm={() => onRemove(x.id)} /> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <form className="cladd" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onAdd(text.trim()); setText(''); } }}>
            <label className="sr" htmlFor={`ci-${card.id}`}>Add an item</label>
            <input id={`ci-${card.id}`} className="search-input" placeholder="Add an item" autoFocus={started && items === null} value={text} onChange={(e) => setText(e.target.value)} />
            <button type="submit" className="chip-btn" disabled={!text.trim()}>Add</button>
          </form>
        </div>
      ) : null}
    </>
  );
}
