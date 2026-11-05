import { useEffect, useRef, useState } from 'react';
import { usePersisted } from './persist';
import { markSeen } from './seen';
import type { Card, CardFile, Draft, Entry } from './types';
import { calendarLabel, cardTag, placeLabel, placeUrl, priorityLabel } from './cardmeta';
import { Checklists } from './Checklists';
import { Linkified } from './Linkified';
import { TripTicket } from './TripTicket';
import { dueText, isEasyToMiss } from './urgency';
import { ConfirmButton } from './ConfirmButton';
import { connectDrive, driveReady } from './drive';

interface Props {
  card: Card;
  entries: Entry[];
  /** Picture data for the card's attachments (the card document holds only names). */
  pics?: CardFile[];
  drafts: Draft[];
  now: Date;
  onBack: () => void;
  onReply: (text: string) => void;
  onPriority?: () => void;
  /** Easy-to-miss flag: true, false, or null for Auto. */
  onIncoming?: (value: boolean | null) => void;
  onBring?: (index: number, got: boolean) => void;
  onItem?: (itemId: string, done: boolean) => void;
  onAddItem?: (text: string) => void;
  onRemoveItem?: (itemId: string) => void;
  /** Delete the card (kept in the records, hidden everywhere). Asked twice before it runs. */
  onDelete?: () => void;
  /** Upload picked files to Drive and record them on the card. Resolves when all are done. */
  onAttach?: (files: File[]) => Promise<{ name: string; url: string }[] | void>;
}

function Icon({ d }: { d: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

export function stamp(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

function incomingState(card: Card): string {
  if (card.incoming === true) return 'On';
  if (card.incoming === false) return 'Off';
  return `Auto: ${isEasyToMiss(card) ? 'on' : 'off'}`;
}

const GENERIC_REPLIES = ['Done', 'Not yet', 'Yes', 'No', "I'll do it"];

export function Thread({ card, entries, pics = [], drafts, now, onBack, onReply, onPriority = () => {}, onIncoming = () => {}, onBring = () => {}, onItem = () => {}, onAddItem = () => {}, onRemoveItem, onDelete, onAttach }: Props) {
  const [attaching, setAttaching] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  // The reply bar is fixed and changes height (ask block, attach pane, chips), so the page keeps clear of its real height.
  useEffect(() => {
    const bar = barRef.current; const page = pageRef.current;
    if (!bar || !page || typeof ResizeObserver === 'undefined') return;
    const set = () => page.style.setProperty('--reply-h', `${bar.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);
  const [drive, setDrive] = useState(driveReady());
  const [busy, setBusy] = useState('');
  const [text, setText] = usePersisted(`reply-${card.id}`);
  useEffect(() => { markSeen(card.id); }, [card.id, entries.length]);
  const mine = drafts.filter((d) => d.linkedNote === card.id);
  const pick = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0 || !onAttach) return;
    setBusy(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}`);
    onAttach(files).then((done) => {
      setBusy('Attached');
      // The upload alone tells Nexo nothing, so it goes out as a reply, together with anything typed in the box.
      const links = (done ?? []).map((d) => `${d.name}: ${d.url}`).join('\n');
      const typed = text.trim();
      onReply([typed, links ? `Attached:\n${links}` : ''].filter(Boolean).join('\n\n'));
      setText('');
    }, (e: unknown) => { setBusy(e instanceof Error ? e.message : 'Upload failed'); setDrive(driveReady()); });
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length === 0 || !onAttach) return;
    e.preventDefault();
    if (!drive) { setAttaching(true); setBusy('Connect Google Drive, then paste again'); return; }
    pick(e.clipboardData.files);
  };
  // Pictures sent from the app are shown under the message that carried their Drive links; any others stay in the block at the top.
  const withThumbs = (card.files ?? []).map((f) => ({ ...f, thumb: pics.find((p) => p.id === f.id)?.thumb ?? f.thumb }));
  const filesIn = (text: string) => withThumbs.filter((f) => f.thumb && f.driveId && text.includes(f.driveId));
  const inChat = new Set(entries.flatMap((e) => filesIn(e.text).map((f) => f.id)));
  const send = () => {
    const t = text.trim();
    if (!t) return;
    onReply(t);
    setText('');
  };
  return (
    <main className="screen thread" ref={pageRef}>
      <header className="thread-top">
        <button className="icon-btn" aria-label="Back" onClick={onBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
        </button>
        <span className="kicker">{dueText(card, now)}{cardTag(card) ? ` · ${cardTag(card)}` : ''}</span>
      </header>
      <h1 className="thread-title">{card.title ?? card.id}</h1>
      <ul className="props">
        <li><Icon d="M4 5h16v15H4zM4 10h16M9 3v4M15 3v4" /><span>{dueText(card, now)}</span></li>
        {card.place ? <li><Icon d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />{placeLabel(card) ? <a href={placeUrl(card.place)} target="_blank" rel="noreferrer">{card.place} <span className="mut">open in Maps</span></a> : <span>{card.place}</span>}</li> : null}
        {cardTag(card) ? <li><Icon d="M4 4h8l8 8-8 8-8-8zM8.5 8.5h.01" /><span>{cardTag(card)}</span></li> : null}
        <li><Icon d="M5 3v18M5 4h12l-2 4 2 4H5" /><button className="prio-btn" onClick={onPriority} aria-label={`Priority ${priorityLabel(card)}, tap to change`}>{priorityLabel(card)} <span className="mut">tap to change</span></button></li>
        <li><Icon d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10.3 20a2 2 0 0 0 3.4 0" /><button className="prio-btn" onClick={() => onIncoming(card.incoming === undefined ? true : card.incoming ? false : null)} aria-label={`Alert 15 min before: ${incomingState(card)}, tap to change`}>Alert 15 min before <span className="mut">{incomingState(card)}</span></button></li>
        {calendarLabel(card) ? <li><Icon d="M4 5h16v15H4zM4 10h16M9 3v4M15 3v4M9 15l2 2 4-4" /><span>{calendarLabel(card)}</span></li> : null}
        <li><Icon d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" /><span>{card.for === 'you' ? 'Waiting on you' : 'With Nexo'}</span></li>
        {mine.length > 0 ? <li><Icon d="M3 6h18v12H3zM4 8l8 6 8-6" /><span>{mine.length} draft{mine.length > 1 ? 's' : ''}</span></li> : null}
      </ul>

      {(() => {
        const shown = withThumbs.filter((f) => f.thumb && !inChat.has(f.id));
        return shown.length > 0 ? (
          <section className="pics" aria-label="Attachments">
            {shown.map((f) => (
              <figure key={f.id}>
                <a href={f.thumb} target="_blank" rel="noreferrer"><img src={f.thumb} alt={f.name ?? 'Attachment'} /></a>
                <figcaption>{f.name ?? 'Attachment'}</figcaption>
              </figure>
            ))}
          </section>
        ) : null;
      })()}
      {card.plan ? <TripTicket plan={card.plan} /> : null}
      <div className="cl-wrap"><Checklists card={card} onBring={onBring} onItem={onItem} onAdd={onAddItem} onRemove={onRemoveItem} /></div>

      <ol className="bubbles">
        {entries.map((e) => {
          const you = e.by === 'eduardo';
          return (
            <li key={e.id} className={`bubble-wrap ${you ? 'you' : 'nexo'}`}>
              <span className="who">{you ? 'YOU' : 'NEXO'} · <span className="mono">{stamp(e.ts)}</span></span>
              <div className="bubble"><Linkified text={e.text} /></div>
              {filesIn(e.text).map((f) => (
                <a key={f.id} className="chat-pic" href={f.viewUrl ?? f.thumb} target="_blank" rel="noreferrer"><img src={f.thumb} alt={f.name ?? 'Attachment'} /></a>
              ))}
            </li>
          );
        })}
      </ol>
      {mine.length > 0 ? <a className="draft-link" href="#/drafts">Open the draft{mine.length > 1 ? 's' : ''}</a> : null}

      {onDelete ? <div className="thread-foot"><ConfirmButton label="Delete card" armedLabel="Tap again to delete" className="chip-btn small" onConfirm={onDelete} /></div> : null}

      <div className="reply-bar" ref={barRef}>
        {card.ask ? (
          <aside className="ask-block" aria-label="What Nexo needs from you">
            <b>What I need from you</b>
            <p><Linkified text={card.ask} /></p>
          </aside>
        ) : null}
        <div className="reply-actions">
          {onAttach ? <button className="chip-btn" onClick={() => setAttaching((a) => !a)}>Attach</button> : null}
        </div>
        {attaching && onAttach ? (
          <section className="join-pane" aria-label="Attach a photo or file">
            {drive ? (
              <>
                <label className="chip-btn">Take a photo<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files)} /></label>
                <label className="chip-btn">Choose photos or files<input type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => pick(e.target.files)} /></label>
              </>
            ) : (
              <button className="act-ink" onClick={() => { setBusy('Opening Google'); connectDrive().then(() => { setDrive(true); setBusy(''); }, (e: unknown) => setBusy(e instanceof Error ? e.message : 'Could not connect')); }}>Connect Google Drive</button>
            )}
            {busy ? <p className="mut" role="status">{busy}</p> : <p className="mut">Files go to the Nexo attachments folder in your Drive.</p>}
          </section>
        ) : null}
        <div className="qchips" role="group" aria-label="Quick replies">
          {(card.qreplies && card.qreplies.length > 0 ? card.qreplies : GENERIC_REPLIES).map((q) => (
            <button key={q} type="button" className="qchip" onClick={() => setText(q)}>{q}</button>
          ))}
        </div>
        <form className="reply-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label className="sr" htmlFor="reply">Reply to this card</label>
          <input id="reply" className="reply-input" placeholder="Reply" onPaste={onPaste} value={text} onChange={(e) => setText(e.target.value)} />
          <button type="submit" className="send small" aria-label="Send reply" disabled={!text.trim()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </form>
      </div>
    </main>
  );
}
