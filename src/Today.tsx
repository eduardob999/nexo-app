import { useState } from 'react';
import { cardTags, holidayLine, placeLabel, placeUrl } from './cardmeta';
import { isHis, nexoSection, SECTION_LABEL, SECTION_ORDER } from './nexo';
import { NexoPanel } from './NexoPanel';
import { Nearby } from './Nearby';
import { isNewCard } from './seen';
import { untilLabel } from './sleep';
import { TodayStrip } from './TodayStrip';
import { assignmentHeat } from './assignment';
import { WakeSuggestion } from './WakeSuggestion';
import type { SleepPlan, SleepRec } from './sleepmodel';
import type { WakeDoc, WakeFeedback, WakePrefs, WakeRecord } from './alarm';
import { Relays } from './Relays';
import { RestCheckin } from './RestCheckin';
import type { RestRec } from './restmodel';
import type { Card, NexoStatus, Relay, TodayInfo } from './types';
import { bandOf, countdownText, dueText, meetingLink, minutesToStart, onTodayBoard, sortQueue, type Band } from './urgency';

interface Props {
  cards: Card[];
  now: Date;
  fromCache: boolean;
  /** Open this assignment in Fude, with everything Nexo knows about it. */
  onFude?: ((card: Card) => void) | undefined;
  onDone: (card: Card) => void;
  onLater: (card: Card) => void;
  /** Join the picked cards into one. Nothing is deleted: the originals are closed and point at the new card. */
  onJoin?: ((cards: Card[]) => void) | undefined;
  onCallNexo: (mail?: boolean) => void;
  onWake?: () => void;
  lane?: 'you' | 'nexo';
  /** Ids of cards that have a draft waiting, shown as a small envelope instead of a line of text. */
  withDraft?: Set<string>;
  /** Open cards whose last entry is his: what Nexo has to read and answer when called. */
  waiting?: number;
  nexo?: NexoStatus | null | undefined;
  info?: TodayInfo | null | undefined;
  relays?: Relay[];
  /** Answers he has pasted back, shown on Nexo's lane until it files them. */
  answeredRelays?: Relay[];
  onAnswerRelay?: (relay: Relay, text: string) => void;
  onCloseRelay?: (relay: Relay) => void;
  wake?: WakeDoc | null | undefined;
  onRecordWake?: ((date: string, rec: WakeRecord) => void) | undefined;
  onAnswerWake?: ((date: string, rec: WakeRecord, feedback: WakeFeedback, prefs: WakePrefs) => void) | undefined;
  sleep?: SleepRec[] | undefined;
  rest?: RestRec[] | undefined;
  onRateRest?: ((date: string, patch: { wellbeing?: number | null; performance?: number | null; activities?: Record<string, boolean>; note?: string }) => void) | undefined;
  sleepActions?: {
    onGoToBed: () => void; onUndoBed: (night: string) => void; onImUp: (night: string) => void;
    onRate: (night: string, rating: number | null, factors: Record<string, boolean | number>, note: string) => void;
    onEditTimes: (night: string, times: { bed?: [number, number]; wake?: [number, number] | null }) => void;
    onPlan: (plan: SleepPlan) => void;
  } | undefined;
}

const BAND_LABEL: Record<Band, string> = {
  incoming: 'Incoming', assignment: 'Assignments', qa: 'Questions and answers', urgent: 'Urgent', overdue: 'Overdue', today: 'Today', prep: 'Preparation', other: 'Later',
};
/** Today shows five groups. Nexo's own lane has no date rules of its own, so it also shows the rest. */
const HEALTH_LABEL = { ok: 'online', late: 'late', offline: 'OFFLINE', blocked: 'BLOCKED', asleep: 'asleep' } as const;
const YOU_BANDS: Band[] = ['incoming', 'assignment', 'qa', 'urgent', 'overdue', 'today', 'prep'];
const NEXO_BANDS: Band[] = [...YOU_BANDS, 'other'];

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" />
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

type PickProps = { selecting: boolean; picked: boolean; onPick: (card: Card) => void };
const NOPICK: PickProps = { selecting: false, picked: false, onPick: () => {} };

/** One line of what the card carries inside: trip times and the bring list, so they show without opening it. */
function prepLine(card: Card): string {
  const parts: string[] = [];
  const out = card.plan?.out;
  if (out?.leave || out?.arrive) parts.push(`Leave ${out.leave ?? '--:--'} → arrive ${out.arrive ?? '--:--'}`);
  const bring = card.bring ?? [];
  if (bring.length > 0) {
    const missing = bring.filter((b) => !b.got).map((b) => b.t);
    parts.push(missing.length === 0 ? `Bring: all ${bring.length} packed` : `Bring: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ` +${missing.length - 3}` : ''}`);
  }
  const items = (card as { items?: { done?: boolean }[] }).items ?? [];
  if (items.length > 0) parts.push(`Checklist ${items.filter((i) => i.done).length}/${items.length}`);
  return parts.join(' · ');
}

function Row({ onFude, card, now, onDone, onLater, hasDraft, closeable = false, pick = NOPICK }: { onFude?: ((card: Card) => void) | undefined; card: Card; now: Date; onDone: Props['onDone']; onLater: Props['onLater']; hasDraft: boolean; closeable?: boolean; pick?: PickProps }) {
  const [open, setOpen] = useState(false);
  const band = bandOf(card, now);
  const title = card.title ?? card.id;
  const mins = band === 'incoming' ? minutesToStart(card, now) : null;
  const link = band === 'incoming' ? meetingLink(card) : null;
  const hol = holidayLine(card, now);
  const heat = band === 'assignment' ? assignmentHeat(card, now) : null;
  const approaching = !!heat && (heat.level === 'soon' || heat.level === 'critical' || heat.level === 'overdue');
  return (
    <li className={`row band-${band}${heat ? ` heat-${heat.level}` : ''}${approaching ? ' approaching' : ''}${isNewCard(card) ? ' is-new' : ''}${pick.picked ? ' picked' : ''}`}>
      {pick.selecting
        ? <input type="checkbox" className="pickbox" checked={pick.picked} aria-label={`Select: ${title}`} onChange={() => pick.onPick(card)} />
        : <button className="ring" aria-label={`Mark done: ${title}`} onClick={() => onDone(card)} />}
      <div className="row-body">
        <button className="row-main" aria-expanded={open} onClick={() => (pick.selecting ? pick.onPick(card) : setOpen(!open))}>
          {approaching ? <span className="deadline-kicker">{heat?.level === 'overdue' ? 'Overdue' : 'Due soon'}</span> : null}
          <span className="row-title">{isNewCard(card) ? <i className="new-dot" aria-label="New message from Nexo" /> : null}{title}</span>
          <span className="row-meta">
            {cardTags(card).map((t) => <span key={t} className="tagchip">{t}</span>)}
            {mins !== null ? <span className="countdown">{countdownText(mins)}</span> : null}
            {heat ? <span className={`heat-chip heat-${heat.level}${approaching ? ' big' : ''}`}>{heat.label}</span> : null}
            <CalendarIcon />{dueText(card, now)}
            {card.for === 'nexo' ? <span className="draft-flag">With Nexo</span> : null}
            {hasDraft ? <span className="draft-flag"><MailIcon />Draft</span> : null}
          </span>
          {card.ask ? <span className="row-ask"><b>Nexo asks</b> {card.ask}</span> : null}
          {hol ? <span className="row-hol">{hol}</span> : null}
          {prepLine(card) ? <span className="row-prep">{prepLine(card)}</span> : null}
          {card.last && !card.ask && (open || (card.entryCount ?? 0) >= 2) ? (
            <span className="row-last"><b>{card.last.by === 'eduardo' ? 'You' : 'Nexo'}</b> {card.last.text}</span>
          ) : null}
        </button>
        {onFude && band === 'assignment' ? <button type="button" className="tool-chip fude-chip" onClick={() => onFude(card)}>Fude</button> : null}
        {link ? <a className="join-link" href={link} target="_blank" rel="noreferrer">Join</a> : null}
        {placeLabel(card) && placeLabel(card) !== link ? <a className="pin pin-link" href={placeUrl(placeLabel(card) as string)} target="_blank" rel="noreferrer" aria-label={`Open ${placeLabel(card)} in Google Maps`}><PinIcon />{placeLabel(card)}</a> : null}
        {closeable ? (
          <div className="row-actions">
            <span className="mut">Nothing is owed on this.</span>
            <button className="chip-btn" onClick={() => onDone(card)}>Mark done</button>
          </div>
        ) : null}
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

export function Today({ onFude, cards, now, fromCache, onDone, onLater, onJoin, onCallNexo, onWake = () => {}, lane = 'you', withDraft, waiting = 0, nexo, info, relays = [], answeredRelays = [], onAnswerRelay = () => {}, onCloseRelay = () => {}, wake, onRecordWake, onAnswerWake, sleep, sleepActions, rest, onRateRest }: Props) {
  const mine = sortQueue(cards.filter((c) => (lane === 'you' ? onTodayBoard(c, now) : c.for === lane && !isHis(c))), now);
  const wanted = lane === 'you' ? YOU_BANDS : NEXO_BANDS;
  const groups = wanted.map((b) => ({ band: b, items: mine.filter((c) => bandOf(c, now) === b) })).filter((g) => g.items.length > 0);
  const [calledAt, setCalledAt] = useState(0);
  const [mail, setMail] = useState(() => { try { return localStorage.getItem('nexo.callMail') === '1'; } catch { return false; } });
  const toggleMail = (v: boolean) => { setMail(v); try { localStorage.setItem('nexo.callMail', v ? '1' : '0'); } catch { /* private mode */ } };
  const press = () => { setCalledAt(Date.now()); onCallNexo(mail); };
  const titles = new Map(cards.map((c) => [c.id, c.title ?? c.id]));
  const sections = lane === 'nexo' ? SECTION_ORDER.map((k) => ({ key: k, items: mine.filter((c) => nexoSection(c, now) === k) })).filter((g) => g.items.length > 0) : [];
  const count = lane === 'nexo' ? mine.length : groups.reduce((n, g) => n + g.items.length, 0);
  const stamp = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
  const holiday = lane === 'you' ? todayHoliday(cards, now) : undefined;
  const [selecting, setSelecting] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  const togglePick = (c: Card) => setPicks((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]));
  const pickFor = (c: Card): PickProps => ({ selecting, picked: picks.includes(c.id), onPick: togglePick });
  const stopSelecting = () => { setSelecting(false); setPicks([]); };
  const hidden = lane === 'you' ? mine.filter((c) => bandOf(c, now) === 'other').length : 0;

  return (
    <main className="screen">
      <header className="top top-wrap">
        <span className="kicker">{stamp} · {count} {lane === 'you' ? 'LEFT' : 'WITH NEXO'}{nexo?.health && nexo.health.state !== 'asleep' ? (nexo.health.state === 'ok'
          ? <i className="health-dot" role="img" aria-label="Nexo is online" title="Nexo is online" />
          : <span className={`health health-${nexo.health.state}`} title={nexo.health.note || undefined}> · {HEALTH_LABEL[nexo.health.state]}</span>) : null}</span>
        <h1>{lane === 'you' ? 'Today' : 'Nexo'}</h1>
        {onJoin && count > 1 && !selecting ? <button className="chip-btn small sel-btn" onClick={() => setSelecting(true)}>Select</button> : null}
        <div className="deck">
          <div className={`call-split${mail ? ' mail-on' : ''}`}>
            <button className="call" onClick={press}
              aria-label={waiting > 0 ? `Call Nexo, ${waiting} ${waiting === 1 ? 'card' : 'cards'} to revise` : 'Call Nexo'}>
              <svg className="reactor" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" strokeDasharray="3 2.4" className="reactor-ring" /><circle cx="12" cy="12" r="6.2" /><circle cx="12" cy="12" r="2.4" fill="currentColor" />
              </svg>
              <span className="call-label">Call Nexo</span>
              {waiting > 0 ? <span className="call-count" aria-hidden="true">{waiting}</span> : null}
            </button>
            <button className="mail-seg" type="button" aria-pressed={mail} aria-label="Also check my mail" title="Also check my mail" onClick={() => toggleMail(!mail)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 8 8 6 8-6" /></svg>
              <span className="mail-tag">{mail ? 'ON' : 'MAIL'}</span>
            </button>
          </div>
          <a className="chat-btn" href="#/chat" aria-label="Live chat with Nexo">
            <span className={`live-dot${nexo?.health && nexo.health.state !== 'ok' ? ' off' : ''}`} aria-hidden="true" />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" /></svg>
            Live chat
          </a>
        </div>
      </header>
      {nexo?.sleepUntil && Date.parse(nexo.sleepUntil) > now.getTime() ? (
        <section className="nexo-panel asleep" aria-live="polite">
          <p className="np-head">Nexo is asleep until {untilLabel(new Date(nexo.sleepUntil), now)}</p>
          <p className="np-sub">It makes no calls while asleep. Mail checks and the nightly check-in are skipped, not queued.</p>
          <button className="copy-main alt" onClick={onWake}>Wake Nexo</button>
        </section>
      ) : null}
      <NexoPanel status={nexo} calledAt={calledAt} titles={titles} />
      {lane === 'you' ? <Relays relays={relays} onAnswer={onAnswerRelay} onClose={onCloseRelay} /> : <Relays mode="answered" relays={answeredRelays} onAnswer={onAnswerRelay} onClose={onCloseRelay} />}
      {lane === 'you' ? <TodayStrip info={info} now={now} cards={cards} /> : null}
      {lane === 'you' ? <WakeSuggestion cards={cards} now={now} wake={wake} onRecord={onRecordWake} onAnswer={onAnswerWake} sleep={sleep} onGoToBed={sleepActions?.onGoToBed} onUndoBed={sleepActions?.onUndoBed} onImUp={sleepActions?.onImUp} onRate={sleepActions?.onRate} onEditTimes={sleepActions?.onEditTimes} onPlan={sleepActions?.onPlan} /> : null}
      {lane === 'you' && rest && onRateRest ? <RestCheckin recs={rest} now={now} onRate={onRateRest} /> : null}
      {/* Card nmw9woh8bpsx: closest combini, station, toilet, pharmacy. Its own button, nothing runs until pressed. */}
      {lane === 'you' ? <Nearby /> : null}
      {holiday && !info ? <p className="holiday">{holiday.title ?? 'Holiday today'}</p> : null}
      {fromCache ? <p className="notice">Showing saved data. Waiting for the network.</p> : null}
      {lane === 'nexo' && sections.length > 0 ? (
        <div className="panel">
          {sections.map((g) => (
            <section key={g.key}>
              <h2 className={`band-title sec-${g.key}`}>{SECTION_LABEL[g.key]} <span>{g.items.length}</span></h2>
              <ul className="rows">
                {g.items.map((c) => <Row key={c.id} onFude={onFude} card={c} now={now} onDone={onDone} onLater={onLater} hasDraft={withDraft?.has(c.id) ?? false} closeable={g.key === 'close'} pick={pickFor(c)} />)}
              </ul>
            </section>
          ))}
        </div>
      ) : lane === 'nexo' ? <p className="empty">Nexo has nothing open.</p> : groups.length === 0 ? <p className="empty">{lane === 'you' ? 'Nothing needs you.' : 'Nexo has nothing open.'}</p> : (
        <div className="panel">
          {groups.map((g) => (
            <section key={g.band}>
              <h2 className={`band-title band-${g.band}`}>{BAND_LABEL[g.band]} <span>{g.items.length}</span></h2>
              <ul className="rows">
                {g.items.map((c) => <Row key={c.id} onFude={onFude} card={c} now={now} onDone={onDone} onLater={onLater} hasDraft={withDraft?.has(c.id) ?? false} pick={pickFor(c)} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
      {selecting ? (
        <div className="join-bar" role="group" aria-label="Join cards">
          <span>{picks.length === 0 ? 'Tick two or more cards that are one request' : `${picks.length} selected`}</span>
          <button className="copy-main alt" disabled={picks.length < 2} onClick={() => { onJoin?.(mine.filter((c) => picks.includes(c.id))); stopSelecting(); }}>Join {picks.length >= 2 ? picks.length : ''}</button>
          <button className="chip-btn" onClick={stopSelecting}>Cancel</button>
        </div>
      ) : null}
      {hidden > 0 ? <a className="more-link" href="#/upcoming">{hidden} more in Upcoming</a> : null}
    </main>
  );
}
