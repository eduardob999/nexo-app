import { useState } from 'react';
import { Face } from './SleepFeedback';
import { ACTIVITIES, type RestAsk, type RestRec } from './restmodel';

const WORDS = ['Awful', 'Poor', 'OK', 'Good', 'Great'] as const;

interface Props {
  rec: RestRec;
  ask: RestAsk['ask'];
  onSave: (patch: { wellbeing?: number | null; performance?: number | null; activities?: Record<string, boolean>; note?: string }) => void;
  onClose: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${DAYS[new Date(y, m - 1, d).getDay()]} ${d}`;
}

/** Two questions, asked at different times: how he feels after a rest day, and how the day after went. */
export function RestSheet({ rec, ask, onSave, onClose }: Props) {
  const well = ask === 'wellbeing';
  const [value, setValue] = useState<number | null>(well ? rec.wellbeing : rec.performance);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(Object.entries(rec.activities ?? {}).filter(([, v]) => v === true)));
  const [note, setNote] = useState(rec.note ?? '');
  const save = () => {
    const base = well ? { wellbeing: value, activities: Object.fromEntries(ACTIVITIES.map((a) => [a.key, on[a.key] === true])) } : { performance: value };
    onSave(note.trim() === (rec.note ?? '') ? base : { ...base, note: note.trim() });
  };
  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet sleep-sheet" role="dialog" aria-label={well ? 'How do you feel after resting' : 'How did the day after go'} onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <span className="grab" />
        <div>
          <b className="sheet-title">{well ? 'How do you feel after resting?' : 'How did today go after resting?'}</b>
          <p className="mut sheet-sub">{well ? `Rest day, ${dayLabel(rec.date)}. Mood, energy, body: one overall feeling.` : `Yesterday, ${dayLabel(rec.date)}, was a rest day. Focus and getting things done today.`}</p>
        </div>
        <div className="faces" role="radiogroup" aria-label={well ? 'Wellbeing' : 'Performance'}>
          {WORDS.map((w, i) => (
            <button type="button" key={w} role="radio" aria-checked={value === i + 1} className={`face ${value === i + 1 ? 'on' : ''}`} onClick={() => setValue(value === i + 1 ? null : i + 1)}>
              <Face v={i + 1} /><small>{w}</small>
            </button>
          ))}
        </div>
        {well ? (
          <div className="factors" role="group" aria-label="What the day was like">
            {ACTIVITIES.map((a) => (
              <button type="button" key={a.key} className="chip-btn small factor" aria-pressed={on[a.key] === true} onClick={() => setOn({ ...on, [a.key]: !on[a.key] })}>{a.label}</button>
            ))}
          </div>
        ) : null}
        <input className="sleep-note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="sheet-foot">
          <button type="button" className="chip-btn" onClick={onClose}>Later</button>
          <button type="submit" className="send-wide">Save</button>
        </div>
      </form>
    </div>
  );
}
