import { AddSheet } from '../AddSheet';
import { Browse } from '../Browse';
import { Drafts } from '../Drafts';
import { Search } from '../Search';
import { Money } from '../Money';
import { Notes } from '../Notes';
import { Shelf } from '../Shelf';
import { Trips } from '../Trips';
import { Upcoming } from '../Upcoming';
import { WakeAlarm } from '../WakeAlarm';
import { Thread } from '../Thread';
import { Today } from '../Today';
import { TabBar } from '../TabBar';
import type { Card, Draft, Entry, NexoStatus } from '../types';
import type { TodayInfo } from '../strip';

/** Invented cards, so the screens can be rendered without signing in or touching real data. */
const NOW = new Date('2026-11-02T12:00:00+09:00');
const FIXTURES: Card[] = [
  { id: 'a', status: 'open', for: 'you', type: 'ASSIGNMENT', title: 'Report for the polymer chemistry course', due: '2026-11-19T12:00:00+09:00', entryCount: 3, last: { by: 'nexo', text: 'Submit inline in the course site.', ts: '2026-11-01T10:00:00+09:00' } },
  { id: 'u', status: 'open', for: 'you', type: 'TASK', prio: 'high', title: 'Confirm the lab visit time with the supervisor', ask: 'Do you want Thursday 10:00 or Friday 14:00 for the visit?' },
  { id: 'b', status: 'open', for: 'you', type: 'TASK', title: 'Reply to the housing office about the lease form', due: '2026-11-01', entryCount: 2, last: { by: 'nexo', text: 'Draft ready, waiting for your approval.', ts: '2026-11-01T09:00:00+09:00' } },
  { id: 'c', status: 'open', for: 'you', type: 'TASK', title: 'Seminar 15:00, Building 3 room 204', due: '2026-11-02T15:00:00+09:00', place: 'Building 3, room 204', entryCount: 1 },
  { id: 'p1', status: 'open', for: 'you', type: 'TRIP', title: 'Trip to the dojo Sat 7 Nov: leave 08:50', due: '2026-11-07T08:50:00+09:00', bring: [{ t: 'uniform' }, { t: 'water' }], place: 'Gion' },
  { id: 'p2', status: 'open', for: 'you', type: 'TASK', title: 'Bicycle registration Thu 5 Nov 11:00', due: '2026-11-05T11:00:00+09:00', prio: 'high', bring: [{ t: 'ID card' }] },
  { id: 'i1', status: 'open', for: 'you', type: 'INFO', title: 'Lecture, room A', due: '2026-11-04T10:30:00+09:00' },
  { id: 'h', status: 'open', for: 'you', type: 'HOLIDAY', title: 'Holiday: Culture Day', due: '2026-11-02T00:00:00+09:00' },
  { id: 'f', status: 'open', for: 'nexo', title: 'Check the bank notice', due: '2026-11-02' },
  { id: 'g', status: 'open', for: 'you', type: 'TASK', title: 'Send Carla the commuter pass steps' },
];

const ENTRIES: Entry[] = [
  { id: '0000', by: 'eduardo', ts: '2026-10-30T10:12:00+09:00', text: 'They asked for the signed form by Monday. Can you check what they still need?' },
  { id: '0001', by: 'nexo', ts: '2026-10-30T10:31:00+09:00', text: 'They need the signed form and a copy of your residence card. Form: [housing form](https://example.org/form) or https://example.org/help. Nothing else is missing.' },
  { id: '0002', by: 'nexo', ts: '2026-10-31T09:02:00+09:00', text: 'Draft ready, waiting for your approval.' },
];
const DRAFTS: Draft[] = [
  { id: 'd1', linkedNote: 'b', status: 'drafted', to: ['housing@example.org'], subject: 'Re: Lease form for the winter term', text: 'Dear Tanaka-san,\n\nThank you for the reminder. I will bring the signed lease form and a copy of my residence card to the office on Monday morning. Please let me know if anything else is needed.' },
  { id: 'd2', status: 'drafted', copiedAt: '2026-11-01T10:00:00+09:00', to: ['events@example.org'], subject: 'Re: Thank you for the invitation', text: 'Thank you very much for the invitation. I look forward to the seminar on Monday afternoon.' },
  { id: 'd4', status: 'drafted', to: ['friend@example.org'], subject: 'Re: Saturday', text: 'See you Saturday.', sendRequestedAt: new Date(Date.now() - 4 * 60_000).toISOString() },
  { id: 'd5', status: 'sent', to: ['friend@example.org'], subject: 'Re: Dinner', text: 'x', sentAt: new Date(Date.now() - 3600_000).toISOString(), sentBy: 'nexo' },
  { id: 'd6', status: 'drafted', to: ['dojo@example.org'], subject: 'Re: Shift on Tuesday', text: 'I can take the Tuesday shift.', revise: { text: 'mention that I arrive at 18:15', at: new Date(Date.now() - 6 * 60_000).toISOString(), by: 'eduardo' } },
  { id: 'd3', status: 'needs-info', topic: 'Reply about the bike registration', need: 'the frame number from the registration card' },
];

const INFO: TodayInfo = {
  updated: new Date(Date.now() - 40 * 60_000).toISOString(),
  weather: { place: 'Uji', now: { temp: 12, text: 'partly cloudy' }, days: [
    { date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }), text: 'heavy drizzle', min: 12, max: 19, rain: 64, sunset: '17:00' },
    { date: new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }), text: 'rain', min: 14, max: 22, rain: 75 }] },
  transit: [{ line: '京阪宇治線', status: '平常運転', ok: true }, { line: '京阪本線', status: '遅延 15分', ok: false }],
  nextFree: { start: new Date(Date.now() + 16 * 86_400_000).toISOString().slice(0, 10), name: 'November Festival', kind: 'university', lab: 'confirm' },
  birthdays: [{ name: 'Carla', date: new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10) }],
};

const WORKING: NexoStatus = {
  health: { state: 'ok', note: '' },
  phase: 'working', startedAt: new Date(Date.now() - 3 * 60_000).toISOString(), queuedAt: null, total: 4, answered: 2, lastOutcome: null, lastEndedAt: null,
  cards: [
    { id: 'a', title: 'Reply to the housing office', answered: true },
    { id: 'b', title: 'Confirm the lab visit time', answered: true },
    { id: 'c', title: 'Bicycle registration Thu 5 Nov', answered: false },
    { id: 'd', title: 'Contact lens delivery on Friday', answered: false },
  ],
};

export function PreviewApp() {
  const which = window.location.hash.replace('#/preview', '').replace(/^\//, '');
  const card = { ...(FIXTURES[2] as Card), bring: [{ t: 'Signed lease form', got: true }, { t: 'Residence card' }, { t: 'Pen' }], items: [{ id: 'i1', text: 'Ask about the deposit', done: false }], ask: 'Should I send the signed form on Monday, or wait for their reply?', qreplies: ['Send it Monday', 'Wait for their reply', 'Call them first'] };
  if (which === 'thread') {
    return <Thread card={card} entries={ENTRIES} drafts={DRAFTS} now={NOW} onBack={() => {}} onReply={() => {}} onDone={() => {}} onLater={() => {}} />;
  }
  if (which === 'alarm') {
    const evening = new Date('2026-11-04T21:00:00+09:00');
    const cs: Card[] = [{ id: 'x', status: 'open', for: 'you', title: 'Lab meeting with Mamitsuka-sensei', due: '2026-11-05T09:30', place: 'Uji campus' }];
    return <WakeAlarm cards={cs} now={evening} />;
  }
  if (which === 'upcoming') {
    return (<><Upcoming cards={FIXTURES} now={NOW} onDone={() => {}} /><TabBar current="upcoming" draftCount={DRAFTS.length} /></>);
  }
  if (which === 'browse') {
    return (<><Browse nexoCount={1} draftCount={DRAFTS.length} settings={{ theme: 'auto', compact: false, start: 'today' }} onSettings={() => {}} onSleep={() => {}} /><TabBar current="browse" draftCount={DRAFTS.length} /></>);
  }
  if (which === 'money') {
    const month = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }).slice(0, 7);
    return (<><Money onAdd={() => {}} onToggle={() => {}} onEdit={() => {}} onRepeat={() => {}} onSeed={() => {}} allocations={[
      { id: '1', label: 'Groceries', amount: 35000, done: true, month, tag: 'home' },
      { id: '2', label: 'Rent and utilities', amount: 20000, done: true, month },
      { id: '3', label: 'Carla (debt)', amount: 5500, done: false, month, tag: 'Carla' },
      { id: '4', label: 'Motorcycle lessons', amount: 11000, done: false, month, recurring: false },
      { id: '5', label: 'Old', amount: 9000, done: true, month: '2026-09' }]}
      onLog={() => {}} onAddItem={() => {}} onReceipt={() => {}}
      market={{ items: [{ id: 'a', name: 'Rice' }, { id: 'b', name: 'Eggs' }, { id: 'c', name: 'Milk' }], log: [{ id: 'l1', itemId: 'a', name: 'Rice', ts: new Date(Date.now() - 3 * 3_600_000).toISOString() }, { id: 'l2', itemId: 'a', name: 'Rice', ts: new Date(Date.now() - 2 * 86_400_000).toISOString() }] }}
      receipts={[{ id: 'r1', amount: 299, cat: 'food', vendor: 'Shop (milk cocoa)', ts: new Date().toISOString() }, { id: 'r2', amount: 299, cat: 'food', vendor: 'Shop (milk cocoa)', ts: new Date().toISOString() }, { id: 'r3', amount: 439, cat: 'food', vendor: 'Shop (granola)', ts: new Date().toISOString() }, { id: 'r4', amount: 120, cat: 'supplies', vendor: 'Daiso (bag)', ts: new Date().toISOString() }]} /><TabBar current="browse" draftCount={0} /></>);
  }
  if (which === 'notes') {
    return (<><Notes onKeep={() => {}} memos={[
      { id: 'a', text: 'Try the gradient trick from the OFDFT paper on the small system first.', tags: ['research'], ts: '2026-11-03T10:00:00Z' },
      { id: 'b', text: 'Kanji for medicine words come up in every lecture: drill them.', tags: ['japan', 'study'], ts: '2026-11-02T10:00:00Z' },
      { id: 'c', text: 'Ask about the second seminar slot.', tags: ['research'], ts: '2026-11-01T10:00:00Z' },
      { id: 'd', text: 'Buy a thicker coat before December.', tags: [], ts: '2026-10-30T10:00:00Z' }]} /><TabBar current="browse" draftCount={0} /></>);
  }
  if (which === 'trips') {
    const trip: Card = { id: 't1', status: 'open', for: 'you', type: 'TRIP', trip: true, title: 'Trip to the dojo Sat 7 Nov: leave 08:50', due: '2026-11-03T08:50:00+09:00', place: 'Gion',
      plan: { from: 'Home', to: 'The dojo', why: 'Guide shift, ends about 11:00 (end time assumed).',
        out: { leave: '08:50', from: 'Home (Uji)', arrive: '09:45', to: 'The dojo, behind the shrine', legs: [{ t: '08:50', txt: 'Keihan Uji line, change at Chushojima to an express', dur: 'about 45 min' }, { t: '09:45', txt: 'Gion-Shijo, exit 6, walk about 8 min' }] },
        back: { leave: '11:00', arrive: 'about 12:00', txt: 'Keihan back to Uji.' }, know: ['Arrive 15 min before the start.'], est: 'Trains and walk are estimates.' } };
    return (<><Trips cards={[trip, { ...trip, id: 't2', title: 'Later trip', due: '2026-11-20T10:00:00+09:00' }]} now={NOW} /><TabBar current="browse" draftCount={0} /></>);
  }
  if (which === 'shelf') {
    return (<><Shelf
      done={[{ id: 'x1', status: 'done', for: 'you', title: 'Renew the library card' }, { id: 'x2', status: 'done', for: 'you', title: 'Pay the electricity bill' }]}
      closed={[{ id: 'P-011', status: 'closed', topic: 'Driving test day logistics' }]}
      resources={[{ id: 'a', kind: 'deck', title: 'Whiteboard, one slide', url: 'https://example.org/deck', note: 'The version for the meeting.' }, { id: 'b', kind: 'file', title: 'Residence card scan', url: '/home/me/docs/card.pdf' }, { id: 'c', kind: 'link', title: 'Old link', url: 'https://example.org', archived: true }]}
      onAdd={() => {}} onArchive={() => {}} /><TabBar current="browse" draftCount={0} /></>);
  }
  if (which === 'nexolane') {
    const mk = (id: string, title: string, last: string, extra: Partial<Card> = {}): Card => ({ id, status: 'open', for: 'nexo', title, last: { by: 'nexo', text: last, ts: '2026-11-02T10:00:00+09:00' }, ...extra });
    const lane: Card[] = [
      mk('n1', 'Which dojo shift do you want to swap?', 'Shall I offer Tuesday or Saturday?'),
      mk('n2', 'Look up the carrier for the lens parcel', 'Checking the carrier site now'),
      mk('n3', 'Bicycle registration paperwork', 'Booked. Nothing is needed from you.'),
      mk('n4', 'Library fine', 'Waiting for the office to confirm', { due: '2026-11-20' }),
    ];
    return (<><Today cards={lane} now={NOW} fromCache={false} onDone={() => {}} onLater={() => {}} onCallNexo={() => {}} lane="nexo" /><TabBar current="browse" draftCount={0} /></>);
  }
  if (which === 'asleep') {
    return (<><NexoShell status={{ ...WORKING, phase: 'idle', startedAt: null, cards: [], total: 0, answered: 0, sleepUntil: new Date(Date.now() + 5 * 3_600_000).toISOString() }} /><TabBar current="today" draftCount={DRAFTS.length} /></>);
  }
  if (which === 'working' || which === 'slow' || which === 'queued' || which === 'failed') {
    const st: NexoStatus = which === 'queued' ? { ...WORKING, phase: 'queued', startedAt: null, queuedAt: new Date(Date.now() - 20_000).toISOString(), answered: 0, cards: WORKING.cards.map((c) => ({ ...c, answered: false })) }
      : which === 'slow' ? { ...WORKING, startedAt: new Date(Date.now() - 13 * 60_000).toISOString(), answered: 0, cards: WORKING.cards.map((c) => ({ ...c, answered: false })) }
      : which === 'failed' ? { phase: 'idle', startedAt: null, queuedAt: null, cards: [], total: 0, answered: 0, lastOutcome: 'failed', lastEndedAt: new Date(Date.now() - 5 * 60_000).toISOString() }
      : WORKING;
    return (<><NexoShell status={st} /><TabBar current="today" draftCount={DRAFTS.length} /></>);
  }
  if (which === 'search') {
    return (<><Search cards={FIXTURES} now={NOW} /><TabBar current="browse" draftCount={DRAFTS.length} /></>);
  }
  if (which === 'add') {
    return (<><Today cards={FIXTURES} now={NOW} fromCache={false} onDone={() => {}} onLater={() => {}} onCallNexo={() => {}} /><AddSheet onAdd={() => {}} onClose={() => {}} /></>);
  }
  if (which === 'drafts') {
    return (
      <>
        <Drafts drafts={DRAFTS} onCopied={() => {}} onSent={() => {}} onDiscard={() => {}} onSend={() => {}} onEdit={() => {}} onRevise={() => {}} onAnswer={() => {}} onMailCheck={() => {}} />
        <TabBar current="drafts" draftCount={DRAFTS.length} />
      </>
    );
  }
  return (
    <>
      <Today cards={FIXTURES} now={NOW} fromCache={false} onDone={() => {}} onLater={() => {}} onCallNexo={() => {}} withDraft={new Set(['b'])} waiting={3} info={INFO}
        relays={[{ id: 'P-016', target: 'Perplexity', mode: 'Pro Search', status: 'open', topic: 'Visa renewal: which documents and where', prompt: 'P-016\n\nWhat documents does a status extension need in Kyoto?' }]} />
      <TabBar current="today" draftCount={DRAFTS.length} />
    </>
  );
}

/** Today with a fixed status and a fixed clock, so each state can be rendered. */
function NexoShell({ status }: { status: NexoStatus }) {
  return <Today cards={FIXTURES} now={new Date('2026-11-02T12:00:00+09:00')} fromCache={false} onDone={() => {}} onLater={() => {}} onCallNexo={() => {}} waiting={4} nexo={status} />;
}
