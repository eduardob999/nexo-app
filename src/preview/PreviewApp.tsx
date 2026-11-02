import { AddSheet } from '../AddSheet';
import { Browse } from '../Browse';
import { Drafts } from '../Drafts';
import { Search } from '../Search';
import { Upcoming } from '../Upcoming';
import { Thread } from '../Thread';
import { Today } from '../Today';
import { TabBar } from '../TabBar';
import type { Card, Draft, Entry } from '../types';

/** Invented cards, so the screens can be rendered without signing in or touching real data. */
const NOW = new Date('2026-11-02T12:00:00+09:00');
const FIXTURES: Card[] = [
  { id: 'a', status: 'open', for: 'you', type: 'ASSIGNMENT', title: 'Report for the polymer chemistry course', due: '2026-11-19T12:00:00+09:00', entryCount: 3, last: { by: 'nexo', text: 'Submit inline in the course site.', ts: '2026-11-01T10:00:00+09:00' } },
  { id: 'u', status: 'open', for: 'you', type: 'TASK', prio: 'high', title: 'Confirm the lab visit time with the supervisor' },
  { id: 'b', status: 'open', for: 'you', type: 'TASK', title: 'Reply to the housing office about the lease form', due: '2026-11-01', entryCount: 2, last: { by: 'nexo', text: 'Draft ready, waiting for your approval.', ts: '2026-11-01T09:00:00+09:00' } },
  { id: 'c', status: 'open', for: 'you', type: 'TASK', title: 'Seminar 15:00, Building 3 room 204', due: '2026-11-02T15:00:00+09:00', place: 'Building 3, room 204', entryCount: 1 },
  { id: 'p1', status: 'open', for: 'you', type: 'TRIP', title: 'Trip to the dojo Sat 7 Nov: leave 08:50', due: '2026-11-07T08:50:00+09:00', bring: ['uniform', 'water'], place: 'Gion' },
  { id: 'p2', status: 'open', for: 'you', type: 'TASK', title: 'Bicycle registration Thu 5 Nov 11:00', due: '2026-11-05T11:00:00+09:00', prio: 'high', bring: ['ID card'] },
  { id: 'i1', status: 'open', for: 'you', type: 'INFO', title: 'Lecture, room A', due: '2026-11-04T10:30:00+09:00' },
  { id: 'h', status: 'open', for: 'you', type: 'HOLIDAY', title: 'Holiday: Culture Day', due: '2026-11-02T00:00:00+09:00' },
  { id: 'f', status: 'open', for: 'nexo', title: 'Check the bank notice', due: '2026-11-02' },
];

const ENTRIES: Entry[] = [
  { id: '0000', by: 'eduardo', ts: '2026-10-30T10:12:00+09:00', text: 'They asked for the signed form by Monday. Can you check what they still need?' },
  { id: '0001', by: 'nexo', ts: '2026-10-30T10:31:00+09:00', text: 'They need the signed form and a copy of your residence card. Nothing else is missing.' },
  { id: '0002', by: 'nexo', ts: '2026-10-31T09:02:00+09:00', text: 'Draft ready, waiting for your approval.' },
];
const DRAFTS: Draft[] = [
  { id: 'd1', linkedNote: 'b', status: 'drafted', to: ['housing@example.org'], subject: 'Re: Lease form for the winter term', text: 'Dear Tanaka-san,\n\nThank you for the reminder. I will bring the signed lease form and a copy of my residence card to the office on Monday morning. Please let me know if anything else is needed.' },
  { id: 'd2', status: 'drafted', copiedAt: '2026-11-01T10:00:00+09:00', to: ['events@example.org'], subject: 'Re: Thank you for the invitation', text: 'Thank you very much for the invitation. I look forward to the seminar on Monday afternoon.' },
  { id: 'd3', status: 'needs-info', topic: 'Reply about the bike registration', need: 'the frame number from the registration card' },
];

export function PreviewApp() {
  const which = window.location.hash.replace('#/preview', '').replace(/^\//, '');
  const card = FIXTURES[2] as Card;
  if (which === 'thread') {
    return <Thread card={card} entries={ENTRIES} drafts={DRAFTS} now={NOW} onBack={() => {}} onReply={() => {}} onDone={() => {}} onLater={() => {}} />;
  }
  if (which === 'upcoming') {
    return (<><Upcoming cards={FIXTURES} now={NOW} onDone={() => {}} /><TabBar current="upcoming" draftCount={DRAFTS.length} /></>);
  }
  if (which === 'browse') {
    return (<><Browse nexoCount={1} draftCount={DRAFTS.length} settings={{ theme: 'auto', compact: false, start: 'today' }} onSettings={() => {}} /><TabBar current="browse" draftCount={DRAFTS.length} /></>);
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
        <Drafts drafts={DRAFTS} onCopied={() => {}} onSent={() => {}} onDiscard={() => {}} />
        <TabBar current="drafts" draftCount={DRAFTS.length} />
      </>
    );
  }
  return (
    <>
      <Today cards={FIXTURES} now={NOW} fromCache={false} onDone={() => {}} onLater={() => {}} onCallNexo={() => {}} withDraft={new Set(['b'])} />
      <TabBar current="today" draftCount={DRAFTS.length} />
    </>
  );
}
