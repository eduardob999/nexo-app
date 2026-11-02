import { useState } from 'react';
import type { Card, Draft, Entry } from './types';
import { dueText } from './urgency';

interface Props {
  card: Card;
  entries: Entry[];
  drafts: Draft[];
  now: Date;
  onBack: () => void;
  onReply: (text: string) => void;
  onDone: () => void;
  onLater: () => void;
}

function stamp(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function Thread({ card, entries, drafts, now, onBack, onReply, onDone, onLater }: Props) {
  const [text, setText] = useState('');
  const mine = drafts.filter((d) => d.linkedNote === card.id);
  const send = () => {
    const t = text.trim();
    if (!t) return;
    onReply(t);
    setText('');
  };
  return (
    <main className="screen thread">
      <header className="thread-top">
        <button className="icon-btn" aria-label="Back" onClick={onBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
        </button>
        <span className="kicker">{dueText(card, now)}{card.type ? ` · ${card.type}` : ''}</span>
      </header>
      <h1 className="thread-title">{card.title ?? card.id}</h1>
      {card.place ? <p className="notice">{card.place}</p> : null}

      <ol className="bubbles">
        {entries.map((e) => {
          const you = e.by === 'eduardo';
          return (
            <li key={e.id} className={`bubble-wrap ${you ? 'you' : 'nexo'}`}>
              <span className="who">{you ? 'YOU' : 'NEXO'} · <span className="mono">{stamp(e.ts)}</span></span>
              <div className="bubble">{e.text}</div>
            </li>
          );
        })}
      </ol>
      {mine.length > 0 ? <a className="draft-link" href="#/drafts">Open the draft{mine.length > 1 ? 's' : ''}</a> : null}

      <div className="reply-bar">
        <div className="reply-actions">
          <button className="act-ink" onClick={onDone}>Done</button>
          <button className="chip-btn" onClick={onLater}>Later</button>
        </div>
        <form className="reply-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label className="sr" htmlFor="reply">Reply to this card</label>
          <input id="reply" className="reply-input" placeholder="Reply" value={text} onChange={(e) => setText(e.target.value)} />
          <button type="submit" className="send small" aria-label="Send reply" disabled={!text.trim()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </form>
      </div>
    </main>
  );
}
