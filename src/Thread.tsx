import { useState } from 'react';
import type { Card, Draft, Entry } from './types';
import { calendarLabel, cardTag, priorityLabel } from './cardmeta';
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

function Icon({ d }: { d: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

function stamp(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

const GENERIC_REPLIES = ['Done', 'Not yet', 'Yes', 'No', "I'll do it"];

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
        <span className="kicker">{dueText(card, now)}{cardTag(card) ? ` · ${cardTag(card)}` : ''}</span>
      </header>
      <h1 className="thread-title">{card.title ?? card.id}</h1>
      <ul className="props">
        <li><Icon d="M4 5h16v15H4zM4 10h16M9 3v4M15 3v4" /><span>{dueText(card, now)}</span></li>
        {card.place ? <li><Icon d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" /><span>{card.place}</span></li> : null}
        {cardTag(card) ? <li><Icon d="M4 4h8l8 8-8 8-8-8zM8.5 8.5h.01" /><span>{cardTag(card)}</span></li> : null}
        <li><Icon d="M5 3v18M5 4h12l-2 4 2 4H5" /><span>{priorityLabel(card)}</span></li>
        {calendarLabel(card) ? <li><Icon d="M4 5h16v15H4zM4 10h16M9 3v4M15 3v4M9 15l2 2 4-4" /><span>{calendarLabel(card)}</span></li> : null}
        <li><Icon d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" /><span>{card.for === 'you' ? 'Waiting on you' : 'With Nexo'}</span></li>
        {mine.length > 0 ? <li><Icon d="M3 6h18v12H3zM4 8l8 6 8-6" /><span>{mine.length} draft{mine.length > 1 ? 's' : ''}</span></li> : null}
      </ul>

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
        {card.ask ? (
          <aside className="ask-block" aria-label="What Nexo needs from you">
            <b>What I need from you</b>
            <p>{card.ask}</p>
          </aside>
        ) : null}
        <div className="reply-actions">
          <button className="act-ink" onClick={onDone}>Done</button>
          <button className="chip-btn" onClick={onLater}>Later</button>
        </div>
        <div className="qchips" role="group" aria-label="Quick replies">
          {(card.qreplies && card.qreplies.length > 0 ? card.qreplies : GENERIC_REPLIES).map((q) => (
            <button key={q} type="button" className="qchip" onClick={() => setText(q)}>{q}</button>
          ))}
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
