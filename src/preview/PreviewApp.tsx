import { Today } from '../Today';
import { TabBar } from '../TabBar';
import type { Card } from '../types';

/** Invented cards, so the screens can be rendered without signing in or touching real data. */
const NOW = new Date('2026-11-02T12:00:00+09:00');
const FIXTURES: Card[] = [
  { id: 'a', status: 'open', for: 'you', type: 'ASSIGNMENT', title: 'Report for the polymer chemistry course', due: '2026-11-19T12:00:00+09:00', entryCount: 3, last: { by: 'nexo', text: 'Submit inline in the course site.', ts: '2026-11-01T10:00:00+09:00' } },
  { id: 'b', status: 'open', for: 'you', type: 'TASK', title: 'Reply to the housing office about the lease form', due: '2026-11-01', entryCount: 2, last: { by: 'nexo', text: 'Draft ready, waiting for your approval.', ts: '2026-11-01T09:00:00+09:00' } },
  { id: 'c', status: 'open', for: 'you', type: 'TASK', title: 'Seminar at 15:00, Building 3 room 204', due: '2026-11-02T15:00:00+09:00', place: 'Building 3, room 204', entryCount: 1 },
  { id: 'd', status: 'open', for: 'you', type: 'INFO', title: 'Bring an umbrella tomorrow', due: '2026-11-03', entryCount: 1 },
  { id: 'e', status: 'open', for: 'you', title: 'Decide whether to renew the gym membership' },
  { id: 'f', status: 'open', for: 'nexo', title: 'Check the bank notice', due: '2026-11-02' },
];

export function PreviewApp() {
  return (
    <>
      <Today cards={FIXTURES} now={NOW} fromCache={false} onDone={() => {}} onLater={() => {}} onCallNexo={() => {}} />
      <TabBar current="today" />
    </>
  );
}
