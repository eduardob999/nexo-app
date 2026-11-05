import { AddSheet } from '../AddSheet';
import { Browse } from '../Browse';
import { Drafts } from '../Drafts';
import { Search } from '../Search';
import { Money } from '../Money';
import { Notes } from '../Notes';
import { Shelf } from '../Shelf';
import { Trips } from '../Trips';
import { Upcoming } from '../Upcoming';
import { WakeSuggestion } from '../WakeSuggestion';
import { SleepScreen } from '../SleepScreen';
import { SleepFeedback } from '../SleepFeedback';
import { bedDate, isoLocal, addDays, type SleepRec } from '../sleepmodel';
import { Thread } from '../Thread';
import { Chat } from '../Chat';
import type { ChatMsg } from '../chatlogic';
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
const svgThumb = (c: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="72"><rect width="96" height="72" fill="${c}"/><rect x="20" y="14" width="56" height="44" fill="#fff" opacity=".8"/></svg>`)}`;
const DRAFTS: Draft[] = [
  { id: 'd1', linkedNote: 'b', status: 'drafted', to: ['housing@example.org'], subject: 'Re: Lease form for the winter term', text: 'Dear Tanaka-san,\n\nThank you for the reminder. I will bring the signed lease form and a copy of my residence card to the office on Monday morning. Please let me know if anything else is needed.' },
  { id: 'd2', status: 'drafted', copiedAt: '2026-11-01T10:00:00+09:00', to: ['events@example.org'], subject: 'Re: Thank you for the invitation', text: 'Thank you very much for the invitation. I look forward to the seminar on Monday afternoon.' },
  { id: 'd4', status: 'drafted', to: ['friend@example.org'], subject: 'Re: Saturday', text: 'See you Saturday.', sendRequestedAt: new Date(Date.now() - 4 * 60_000).toISOString() },
  { id: 'd5', status: 'sent', to: ['friend@example.org'], subject: 'Re: Dinner', text: 'x', sentAt: new Date(Date.now() - 3600_000).toISOString(), sentBy: 'nexo' },
  { id: 'd6', status: 'drafted', to: ['dojo@example.org'], subject: 'Re: Shift on Tuesday', text: 'I can take the Tuesday shift.', revise: { text: 'mention that I arrive at 18:15', at: new Date(Date.now() - 6 * 60_000).toISOString(), by: 'eduardo' } },
  { id: 'd7', linkedNote: 'b', status: 'drafted', to: ['housing@example.org'], subject: 'Re: Signed lease form', text: 'Dear Tanaka-san,\n\nPlease find the signed lease form and a copy of my residence card attached.', attachments: [
    { id: 'f1', name: 'lease-page1.jpg', type: 'image/jpeg', driveId: 'x1', viewUrl: 'https://example.org/1' },
    { id: 'f2', name: 'lease-page2.jpg', type: 'image/jpeg', driveId: 'x2', viewUrl: 'https://example.org/2' },
    { id: 'f3', name: 'residence-card-copy-long-name.pdf', type: 'application/pdf', driveId: 'x3', viewUrl: 'https://example.org/3' }] },
  { id: 'd8', status: 'drafted', to: ['office@example.org'], subject: 'Re: Documents', text: 'I am attaching the documents you asked for.' },
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

// A flat grey-blue square standing in for a photographed receipt.
const PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#b9c4d6"/><rect x="22" y="14" width="52" height="68" fill="#fff"/><path d="M30 28h36M30 38h36M30 48h24" stroke="#889" stroke-width="3"/></svg>')}`;

/** Invented nights ending 2026-11-04, with a believable spread of hours, ratings and factors. */
function fakeNights(): SleepRec[] {
  const spec: [number, number, number, number | null, string[]][] = [
    // [bed hour, bed minute, hours, rating, factors]
    [23, 10, 7.8, 4, ['exercise']], [23, 40, 6.5, 2, ['caffeine', 'screen']], [0, 20, 6.2, 2, ['screen', 'stress']], [23, 0, 8.1, 5, ['exercise']],
    [23, 30, 7.4, 3, []], [0, 40, 8.6, 4, ['alcohol']], [1, 10, 8.0, 3, ['alcohol', 'lateMeal']], [23, 15, 7.5, 4, []],
    [23, 50, 6.8, 2, ['caffeine', 'slowToSleep']], [22, 50, 8.2, 5, ['exercise']], [23, 20, 7.2, 3, ['stress']], [0, 5, 6.6, 2, ['screen', 'caffeine']],
    [23, 25, 7.9, 4, []], [23, 45, 7.0, 3, ['noiseLight']],
  ];
  return spec.map(([h, m, hours, rating, f], i) => {
    const night = addDays('2026-11-04', -(spec.length - 1 - i));
    const bed = bedDate(night, h, m);
    return { night, bed: isoLocal(bed), wake: isoLocal(new Date(bed.getTime() + hours * 3_600_000)), rating, factors: Object.fromEntries(f.map((k) => [k, true])), note: '', source: 'nexo-app' };
  });
}

export function PreviewApp() {
  const which = window.location.hash.replace('#/preview', '').replace(/^\//, '');
  const card = { ...(FIXTURES[2] as Card), bring: [{ t: 'Signed lease form', got: true }, { t: 'Residence card' }, { t: 'Pen' }], items: [{ id: 'i1', text: 'Ask about the deposit', done: false }], ask: 'Should I send the signed form on Monday, or wait for their reply?', qreplies: ['Send it Monday', 'Wait for their reply', 'Call them first'] };
  if (which === 'sleep') {
    return (<><SleepScreen recs={fakeNights()} cards={[{ id: 'e', status: 'open', for: 'you', title: 'Lecture, room A', due: '2026-11-06T09:00:00+09:00', place: 'Yoshida campus' }]} now={new Date('2026-11-05T21:10:00+09:00')} /><TabBar current="browse" draftCount={0} /></>);
  }
  if (which.startsWith('sleep-card')) {
    const nights = fakeNights();
    const nowS = new Date(which === 'sleep-card-morning' ? '2026-11-06T07:10:00+09:00' : (which === 'sleep-card-asleep' || which === 'sleep-card-edit') ? '2026-11-06T00:05:00+09:00' : '2026-11-05T22:10:00+09:00');
    const open = { night: '2026-11-05', bed: isoLocal(new Date('2026-11-05T23:44:31+09:00')), wake: null, rating: null, factors: {}, note: '' } as SleepRec;
    const recs = which === 'sleep-card-evening' ? nights : [...nights, open];
    const cs: Card[] = [{ id: 'e', status: 'open', for: 'you', title: 'Lecture, room A', due: '2026-11-06T09:00:00+09:00', place: 'Yoshida campus' }];
    return (<><main className="screen"><header className="top"><div><span className="kicker">THURSDAY 5 NOVEMBER</span><h1>Today</h1></div></header>
      <WakeSuggestion cards={cs} now={nowS} sleep={recs} onGoToBed={() => {}} onUndoBed={() => {}} onImUp={() => {}} onRate={() => {}} onEditTimes={() => {}} startOpen={which === 'sleep-card-edit' ? 'edit' : undefined} /></main><TabBar current="today" draftCount={0} /></>);
  }
  if (which === 'sleep-feedback') {
    return (<><Today cards={[]} now={NOW} fromCache={false} onDone={() => {}} onLater={() => {}} onCallNexo={() => {}} /><SleepFeedbackPreview /></>);
  }
  if (which === 'incoming') {
    const n = new Date('2026-11-02T12:00:00+09:00');
    const at = (min: number) => new Date(n.getTime() + min * 60_000).toISOString();
    const cs: Card[] = [
      { id: 'i1', status: 'open', for: 'you', type: 'CLASS', title: 'Online Japanese class with Handa sensei', due: at(8), place: 'Zoom', last: { by: 'nexo', text: 'Join here: https://us02web.zoom.us/j/81234567890?pwd=abc', ts: at(-600) } },
      { id: 'i2', status: 'open', for: 'you', type: 'MEETING', title: 'Lab meeting', due: at(-3), place: 'Building 3, room 204' },
      { id: 'i3', status: 'open', for: 'you', type: 'TASK', title: 'Reply to the housing office about the lease form', due: '2026-11-02' },
      FIXTURES[0] as Card,
    ];
    return (<><Today cards={cs} now={n} fromCache={false} onDone={() => {}} onLater={() => {}} onCallNexo={() => {}} /><TabBar current="today" draftCount={0} /></>);
  }
  if (which === 'thread') {
    return <Thread card={card} entries={ENTRIES} drafts={DRAFTS} now={NOW} onBack={() => {}} onReply={() => {}} onDelete={() => {}} onRemoveItem={() => {}} />;
  }
  if (which === 'checklist-none') {
    const bare: Card = { ...(FIXTURES[3] as Card) };
    return <Thread card={bare} entries={ENTRIES} drafts={[]} now={NOW} onBack={() => {}} onReply={() => {}} onDelete={() => {}} />;
  }
  if (which === 'join') {
    const cs: Card[] = [...FIXTURES, { id: 'hl', status: 'open', for: 'you', type: 'HOLIDAY', lab: 'confirm', title: 'University break: November Festival', due: '2026-11-02', dueEnd: '2026-11-04' }];
    return (<><Today cards={cs} now={NOW} fromCache={false} onDone={() => {}} onLater={() => {}} onJoin={() => {}} onCallNexo={() => {}} withDraft={new Set(['b'])} info={INFO} /><TabBar current="today" draftCount={0} /></>);
  }
  if (which === 'thread-done') {
    const done: Card = { ...(FIXTURES[2] as Card), status: 'done', doneAt: '2026-11-02T09:30:00+09:00', files: [
      { id: 'q1', name: 'lease-form-signed.pdf', type: 'application/pdf', size: 482_000, viewUrl: 'https://example.org/lease.pdf' },
      { id: 'q2', name: 'residence-card-copy.pdf', type: 'application/pdf', size: 1_900_000 }] };
    return <Thread card={done} entries={ENTRIES} drafts={[]} now={NOW} onBack={() => {}} onReply={() => {}} onReopen={() => {}} />;
  }
  if (which === 'window') {
    return <Thread card={{ ...card, due: '2026-11-05T17:00:00+09:00', dueEnd: '18:00' }} entries={ENTRIES} drafts={[]} now={NOW} onBack={() => {}} onReply={() => {}} onDelete={() => {}} />;
  }
  if (which === 'chat' || which === 'chat-empty') {
    const at = (min: number) => new Date(new Date('2026-11-05T09:00:00+09:00').getTime() + min * 60_000).toISOString();
    const msgs: ChatMsg[] = which === 'chat-empty' ? [] : [
      { id: '1', by: 'you', text: 'What is left today?', ts: at(0), status: 'done' },
      { id: '2', by: 'nexo', text: 'Two things: the bicycle registration at 11:00 (bring your ID card) and the lab seminar at 15:00 in Building 3, room 204.', ts: at(1), route: 'answer' },
      { id: '3', by: 'you', text: 'Add a task: buy stamps, and move the seminar prep to tomorrow', ts: at(3), status: 'done' },
      { id: '4', by: 'nexo', text: 'Done. Details: https://example.org/stamps', ts: at(4), route: 'act', did: ['Added card: Buy stamps', 'Moved Seminar prep to Fri 6 Nov'] },
      { id: '5', by: 'you', text: 'When do I need to leave tomorrow?', ts: at(6), status: 'working' },
    ];
    return <Chat msgs={msgs} onBack={() => {}} onSend={() => {}} />;
  }
  if (which === 'wakeq') {
    return <WakeSuggestion cards={[]} now={new Date('2026-11-05T08:10:00+09:00')} wake={{ prefs: { n: 4 }, log: { '2026-11-05': { minutes: 450, basis: 'travel', lead: 90, first: 'Lab meeting with Mamitsuka-sensei' } } }} onAnswer={() => {}} />;
  }
  if (which === 'alarm') {
    const evening = new Date('2026-11-04T21:00:00+09:00');
    const cs: Card[] = [{ id: 'x', status: 'open', for: 'you', title: 'Lab meeting with Mamitsuka-sensei', due: '2026-11-05T09:30', place: 'Uji campus' }];
    return <WakeSuggestion cards={cs} now={evening} wake={{ prefs: { leadTravel: 75, n: 4 } }} />;
  }
  if (which === 'upcoming') {
    return (<><Upcoming cards={FIXTURES} now={NOW} onDone={() => {}} /><TabBar current="upcoming" draftCount={DRAFTS.length} /></>);
  }
  if (which === 'browse') {
    return (<><Browse uid="preview" nexoCount={1} draftCount={DRAFTS.length} settings={{ theme: 'auto', compact: false, start: 'today' }} onSettings={() => {}} onSleep={() => {}} /><TabBar current="browse" draftCount={DRAFTS.length} /></>);
  }
  if (which === 'money') {
    const month = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }).slice(0, 7);
    return (<><Money onAdd={() => {}} onToggle={() => {}} onEdit={() => {}} onRepeat={() => {}} onSeed={() => {}} allocations={[
      { id: '1', label: 'Groceries', amount: 35000, done: true, month, tag: 'home' },
      { id: '2', label: 'Rent and utilities', amount: 20000, done: true, month },
      { id: '3', label: 'Carla (debt)', amount: 5500, done: false, month, tag: 'Carla' },
      { id: '4', label: 'Motorcycle lessons', amount: 11000, done: false, month, recurring: false },
      { id: '5', label: 'Old', amount: 9000, done: true, month: '2026-09' }]}
      onLog={() => {}} onAddItem={() => {}} onReceipt={() => {}} onUndo={() => {}} onDeleteReceipt={() => {}} onAttachReceipt={async () => {}} watchPhotos={(_id, on) => { on([{ id: 'p1', thumb: PHOTO }]); return () => {}; }}
      market={{ items: [{ id: 'a', name: 'Rice' }, { id: 'b', name: 'Eggs' }, { id: 'c', name: 'Milk' }], log: [{ id: 'l1', itemId: 'a', name: 'Rice', ts: new Date(Date.now() - 3 * 3_600_000).toISOString() }, { id: 'l2', itemId: 'a', name: 'Rice', ts: new Date(Date.now() - 2 * 86_400_000).toISOString() }] }}
      receipts={[{ id: 'r1', amount: 299, cat: 'food', vendor: 'Shop (milk cocoa)', ts: new Date().toISOString(), files: [{ id: 'p1', name: 'receipt.jpg', viewUrl: 'https://example.org' }] }, { id: 'r2', amount: 299, cat: 'food', vendor: 'Shop (milk cocoa)', ts: new Date().toISOString() }, { id: 'r3', amount: 439, cat: 'food', vendor: 'Shop (granola)', ts: new Date().toISOString() }, { id: 'r4', amount: 120, cat: 'supplies', vendor: 'Daiso (bag)', ts: new Date().toISOString() }]} /><TabBar current="browse" draftCount={0} /></>);
  }
  if (which === 'notes') {
    return (<><Notes onKeep={() => {}} onDelete={() => {}} memos={[
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
    return (<><Trips cards={[trip, { ...trip, id: 't2', title: 'Later trip', due: '2026-11-20T10:00:00+09:00' }]} now={NOW} done={[{ ...trip, id: 'p1', status: 'done', title: 'Trip to Osaka for the visa office', due: '2026-10-28T09:00:00+09:00' }]} /><TabBar current="browse" draftCount={0} /></>);
  }
  if (which === 'shelf') {
    return (<><Shelf
      done={[{ id: 'x1', status: 'done', for: 'you', title: 'Renew the library card' }, { id: 'x2', status: 'done', for: 'you', title: 'Pay the electricity bill' }]}
      closed={[{ id: 'P-011', status: 'closed', topic: 'Driving test day logistics' }]}
      resources={[{ id: 'a', kind: 'deck', title: 'Whiteboard, one slide', url: 'https://example.org/deck', note: 'The version for the meeting.' }, { id: 'b', kind: 'file', title: 'Residence card scan', url: '/home/me/docs/card.pdf' }, { id: 'c', kind: 'link', title: 'Old link', url: 'https://example.org', archived: true }]}
      onAdd={() => {}} onArchive={() => {}} onClearDone={() => {}} /><TabBar current="browse" draftCount={0} /></>);
  }
  if (which === 'money-all') {
    const rs = Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, amount: 200 + i * 10, cat: i % 3 ? 'food' : 'transport', vendor: `Shop ${i}`, ts: new Date(Date.now() - i * 3_600_000).toISOString() }))
      .concat([{ id: 'o1', amount: 18104, cat: 'fees', vendor: 'Dojo fee', ts: '2026-10-05T10:00:00+09:00' }]);
    return (<><Money onAdd={() => {}} onToggle={() => {}} onEdit={() => {}} onRepeat={() => {}} onSeed={() => {}} allocations={[]} receipts={rs} onReceipt={() => {}} /><TabBar current="browse" draftCount={0} /></>);
  }
  if (which === 'nexolane-relays') {
    const lane: Card[] = [{ id: 'n2', status: 'open', for: 'nexo', title: 'Look up the carrier for the lens parcel', last: { by: 'nexo', text: 'Checking the carrier site now', ts: '2026-11-02T10:00:00+09:00' } }];
    return (<><Today cards={lane} now={NOW} fromCache={false} onDone={() => {}} onLater={() => {}} onCallNexo={() => {}} lane="nexo"
      answeredRelays={[{ id: 'P-017', target: 'Perplexity', mode: 'Pro Search', status: 'answered', topic: 'Delta learning uncertainty', prompt: 'P-017\n\nWhat is delta learning?', response: 'Delta learning trains a model on the difference between two levels of theory.' }]} /><TabBar current="browse" draftCount={0} /></>);
  }
  if (which === 'drafts-meta') {
    const ds: Draft[] = [
      { id: 'x1', status: 'drafted', contact: '075-123-4567 (Dr Nakata clinic)', subject: 'Call about the appointment', text: 'Hello, I would like to move my appointment to Friday.', editedAt: new Date(Date.now() - 3_600_000).toISOString(), revisedAt: new Date(Date.now() - 7_200_000).toISOString() },
      { id: 'x2', status: 'needs-info', topic: 'Reply about the dojo shift', need: 'which Saturday you can cover', answeredAt: new Date(Date.now() - 1_800_000).toISOString() },
      { id: 'x3', status: 'sent', to: ['a@example.org'], subject: 'Re: Old thing', text: 'x', sentAt: '2026-10-20T10:00:00+09:00', sentBy: 'nexo' },
    ];
    return (<><Drafts drafts={ds} cards={[]} onDetach={() => {}} onAttachExisting={() => {}} onUpload={async () => {}} onCopied={() => {}} onSent={() => {}} onDiscard={() => {}} onSend={() => {}} onEdit={() => {}} onRevise={() => {}} onAnswer={() => {}} /><TabBar current="drafts" draftCount={2} /></>);
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
  if (which === 'receipt') {
    const receipt = { id: 'sandi', amount: 1459, cat: 'food', vendor: 'サンディ 黄檗店', ts: '2026-11-05T18:42:00+09:00', subtotal: 1351, taxTotal: 108, paid: 10000, change: 8541, files: [{ id: 'p1', name: 'receipt.jpg', thumb: PHOTO }],
      lines: [
        { name: '袋代', amount: 10, tax: 10 },
        { name: 'プリマロースハム', qty: 3, unit: 139, amount: 417, tax: 8, item: 'Jamón' },
        { name: 'スライスチーズ', qty: 3, unit: 139, amount: 417, tax: 8, item: 'Queso' },
        { name: 'とろけるスライスC', qty: 2, unit: 139, amount: 278, tax: 8, item: 'Queso' },
        { name: 'パリパリバー', amount: 229, tax: 8, item: 'Helado' }] };
    return (<><Money onAdd={() => {}} onToggle={() => {}} onEdit={() => {}} onRepeat={() => {}} onSeed={() => {}} allocations={[]} receipts={[receipt, { id: 'r2', amount: 299, cat: 'food', vendor: 'Shop (milk cocoa)', ts: '2026-11-04T12:00:00+09:00' }]}
      onAttachReceipt={async () => {}} watchPhotos={(_id, on) => { on([{ id: 'p1', thumb: PHOTO }]); return () => {}; }} /><TabBar current="browse" draftCount={0} /></>);
  }
  if (which === 'add-photos') {
    const mk = (name: string, c: string) => new File([`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="${c}"/><rect x="22" y="14" width="52" height="68" fill="#fff"/></svg>`], name, { type: 'image/svg+xml' });
    return (<><Today cards={FIXTURES} now={NOW} fromCache={false} onDone={() => {}} onLater={() => {}} onCallNexo={() => {}} /><AddSheet onAdd={() => {}} onClose={() => {}} initialFiles={[mk('receipt-1.svg', '#b9c4d6'), mk('receipt-2.svg', '#c9d6b9')]} /></>);
  }
  if (which === 'add') {
    return (<><Today cards={FIXTURES} now={NOW} fromCache={false} onDone={() => {}} onLater={() => {}} onCallNexo={() => {}} /><AddSheet onAdd={() => {}} onClose={() => {}} /></>);
  }
  if (which === 'drafts') {
    return (
      <>
        <Drafts drafts={DRAFTS} cards={FIXTURES} onDetach={() => {}} onAttachExisting={() => {}} onUpload={async () => {}} watchPics={(_id, on) => { on([{ id: 'f1', thumb: svgThumb('#4a7') }, { id: 'f2', thumb: svgThumb('#57a') }]); return () => {}; }} onCopied={() => {}} onSent={() => {}} onDiscard={() => {}} onSend={() => {}} onEdit={() => {}} onRevise={() => {}} onAnswer={() => {}} onMailCheck={() => {}} />
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

function SleepFeedbackPreview() {
  const rec: SleepRec = { night: '2026-11-05', bed: isoLocal(new Date('2026-11-05T23:44:31+09:00')), wake: isoLocal(new Date('2026-11-06T07:12:00+09:00')), rating: 4, factors: { screen: true, caffeine: true }, note: '' };
  return <SleepFeedback rec={rec} wakeLog={{ minutes: 430, basis: 'travel', lead: 90 }} onSave={() => {}} onClose={() => {}} />;
}
