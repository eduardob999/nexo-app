import { useState } from 'react';
import { NexoPanel } from './NexoPanel';
import type { Card, NexoStatus } from './types';
import { bandOf, dueText, onTodayBoard, sortQueue, type Band } from './urgency';

interface Props {
  cards: Card[];
  now: Date;
  fromCache: boolean;
  onDone: (card: Card) => void;
  onLater: (card: Card) => void;
  onCallNexo: () => void;
  lane?: 'you' | 'nexo';
  /** Ids of cards that have a draft waiting, shown as a small envelope instead of a line of text. */
  withDraft?: Set<string>;
  /** Open cards whose last entry is his: what Nexo has to read and answer when called. */
  waiting?: number;
  nexo?: NexoStatus | null | undefined;
}

const BAND_LABEL: Record<Band, string> = {
  assignment: 'Assignments', urgent: 'Urgent', overdue: 'Overdue', today: 'Today', prep: 'Preparation', other: 'Later',
};
/** Today shows five groups. Nexo's own lane has no date rules of its own, so it also shows the rest. */
const YOU_BANDS: Band[] = ['assignment', 'urgent', 'overdue', 'today', 'prep'];
const NEXO_BANDS: Band[] = [...YOU_BANDS, 'other'];

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" role="img">
      <title>Draft ready</title><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 8 8 6 8-6" />
    </svg>
  );
}

function Row({ card, now, onDone, onLater, hasDraft }: { card: Card; now: Date; onDone: Props['onDone']; onLater: Props['onLater']; hasDraft: boolean }) {
  const [open, setOpen] = useState(false);
  const band = bandOf(card, now);
  const title = card.title ?? card.id;
  return (
    <li className={`row band-${band}`}>
      <button className="ring" aria-label={`Mark done: ${title}`} onClick={() => onDone(card)} />
      <div className="row-body">
        <button className="row-main" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="row-title">{title}</span>
          <span className="row-meta">
            <CalendarIcon />{dueText(card, now)}
            {card.for === 'nexo' ? <span className="draft-flag">With Nexo</span> : null}
            {hasDraft ? <span className="draft-flag"><MailIcon />Draft</span> : null}
          </span>
          {open && card.last ? (
            <span className="row-last"><b>{card.last.by === 'eduardo' ? 'You' : 'Nexo'}</b> {card.last.text}</span>
          ) : null}
          {open && card.place ? <span className="row-place">{card.place}</span> : null}
        </button>
        {open ? (
          <div className="row-actions">
            <a className="chip-btn link" href={`#/card/${card.id}`}>Open</a>
            <button className="chip-btn" onClick={() => onLater(card)}>Later</button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function todayHoliday(cards: Card[], now: Date): Card | undefined {
  const k = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return cards.find((c) => c.type === 'HOLIDAY' && (c.due ?? '').slice(0, 10) === k);
}

export function Today({ cards, now, fromCache, onDone, onLater, onCallNexo, lane = 'you', withDraft, waiting = 0, nexo }: Props) {
  const mine = sortQueue(cards.filter((c) => (lane === 'you' ? onTodayBoard(c, now) : c.for === lane)), now);
  const wanted = lane === 'you' ? YOU_BANDS : NEXO_BANDS;
  const groups = wanted.map((b) => ({ band: b, items: mine.filter((c) => bandOf(c, now) === b) })).filter((g) => g.items.length > 0);
  const [calledAt, setCalledAt] = useState(0);
  const press = () => { setCalledAt(Date.now()); onCallNexo(); };
  const titles = new Map(cards.map((c) => [c.id, c.title ?? c.id]));
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  const stamp = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
  const holiday = lane === 'you' ? todayHoliday(cards, now) : undefined;
  const hidden = lane === 'you' ? mine.filter((c) => bandOf(c, now) === 'other').length : 0;

  return (
    <main className="screen">
      <header className="top">
        <div>
          <span className="kicker">{stamp} · {count} {lane === 'you' ? 'LEFT' : 'WITH NEXO'}</span>
          <h1>{lane === 'you' ? 'Today' : 'Nexo'}</h1>
        </div>
        <button className="call" onClick={press}
          aria-label={waiting > 0 ? `Call Nexo, ${waiting} ${waiting === 1 ? 'card' : 'cards'} to revise` : 'Call Nexo'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
          Call Nexo
          {waiting > 0 ? <span className="call-count" aria-hidden="true">{waiting}</span> : null}
        </button>
      </header>
      <NexoPanel status={nexo} calledAt={calledAt} titles={titles} />
      {holiday ? <p className="holiday">{holiday.title ?? 'Holiday today'}</p> : null}
      {fromCache ? <p className="notice">Showing saved data. Waiting for the network.</p> : null}
      {groups.length === 0 ? <p className="empty">{lane === 'you' ? 'Nothing needs you.' : 'Nexo has nothing open.'}</p> : (
        <div className="panel">
          {groups.map((g) => (
            <section key={g.band}>
              <h2 className={`band-title band-${g.band}`}>{BAND_LABEL[g.band]} <span>{g.items.length}</span></h2>
              <ul className="rows">
                {g.items.map((c) => <Row key={c.id} card={c} now={now} onDone={onDone} onLater={onLater} hasDraft={withDraft?.has(c.id) ?? false} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
      {hidden > 0 ? <a className="more-link" href="#/upcoming">{hidden} more in Upcoming</a> : null}
    </main>
  );
}
