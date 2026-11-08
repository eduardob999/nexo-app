import { useState } from 'react';
import { RestSheet } from './RestSheet';
import { restDue, type RestRec } from './restmodel';

interface Props {
  recs: RestRec[];
  now: Date;
  onRate: (date: string, patch: { wellbeing?: number | null; performance?: number | null; activities?: Record<string, boolean>; note?: string }) => void;
}

/** On Today, only when a question is due: the evening of a rest day (wellbeing), the evening after (performance). */
export function RestCheckin({ recs, now, onRate }: Props) {
  const [sheet, setSheet] = useState(false);
  const due = restDue(recs, now);
  if (!due) return null;
  const rec = recs.find((r) => r.date === due.date);
  if (!rec) return null;
  const well = due.ask === 'wellbeing';
  return (
    <section className="wake sleepcard" aria-label="Rest check-in">
      <span className="kicker">REST CHECK-IN</span>
      <p className="wake-q">{well ? 'How do you feel after your rest day?' : 'How did today go after resting?'}<span className="mut">{well ? 'One quick rating, so rest can be compared with how you sleep and perform.' : 'Rate your focus and output today.'}</span></p>
      <button className="copy-main big" onClick={() => setSheet(true)}>{well ? 'Rate how you feel' : 'Rate how it went'}</button>
      {sheet ? <RestSheet rec={rec} ask={due.ask} onClose={() => setSheet(false)} onSave={(patch) => { onRate(rec.date, patch); setSheet(false); }} /> : null}
    </section>
  );
}
