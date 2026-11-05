import { useState } from 'react';
import type { WakeFeedback, WakeRecord } from './alarm';
import { clock } from './alarm';
import { FACTORS, fmtHours, hhmm, durationHours, type SleepRec } from './sleepmodel';

const FACES = [
  { v: 1, label: 'Awful', mouth: 'M8 17q4-4 8 0' },
  { v: 2, label: 'Poor', mouth: 'M8 16q4-2 8 0' },
  { v: 3, label: 'OK', mouth: 'M8 15h8' },
  { v: 4, label: 'Good', mouth: 'M8 14q4 3 8 0' },
  { v: 5, label: 'Great', mouth: 'M7 13q5 6 10 0' },
] as const;

export function Face({ v, size = 30 }: { v: number; size?: number }) {
  const f = FACES[Math.max(0, Math.min(4, v - 1))] as (typeof FACES)[number];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M9 9.5v.5M15 9.5v.5" /><path d={f.mouth} />
    </svg>
  );
}

interface Props {
  rec: SleepRec;
  /** The wake-up suggestion that went off this morning, when it is still unanswered. */
  wakeLog?: WakeRecord | undefined;
  onSave: (rating: number | null, factors: Record<string, boolean | number>, note: string, wakeFeedback?: WakeFeedback) => void;
  onClose: () => void;
}

/** The one survey after waking: how rested, what might explain it, and whether the alarm time was right. */
export function SleepFeedback({ rec, wakeLog, onSave, onClose }: Props) {
  const [rating, setRating] = useState<number | null>(rec.rating ?? null);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(Object.entries(rec.factors ?? {}).filter(([, v]) => v === true)) as Record<string, boolean>);
  const [note, setNote] = useState(rec.note ?? '');
  const [fb, setFb] = useState<WakeFeedback | undefined>(undefined);
  const dur = durationHours(rec);
  const askWake = wakeLog && !wakeLog.feedback;
  const save = () => onSave(rating, Object.fromEntries(FACTORS.map((f) => [f.key, on[f.key] === true])), note.trim(), fb);
  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet sleep-sheet" role="dialog" aria-label="How did you sleep" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <span className="grab" />
        <div>
          <b className="sheet-title">How did you sleep?</b>
          <p className="mut sheet-sub">{dur !== null ? `${fmtHours(dur)}, ` : ''}bed {hhmm(new Date(rec.bed))}{rec.wake ? `, up ${hhmm(new Date(rec.wake))}` : ''}</p>
        </div>
        <div className="faces" role="radiogroup" aria-label="How rested">
          {FACES.map((f) => (
            <button type="button" key={f.v} role="radio" aria-checked={rating === f.v} className={`face ${rating === f.v ? 'on' : ''}`} onClick={() => setRating(rating === f.v ? null : f.v)}>
              <Face v={f.v} /><small>{f.label}</small>
            </button>
          ))}
        </div>
        <div className="factors" role="group" aria-label="What might have mattered">
          {FACTORS.map((f) => (
            <button type="button" key={f.key} className="chip-btn small factor" aria-pressed={on[f.key] === true} onClick={() => setOn({ ...on, [f.key]: !on[f.key] })}>{f.label}</button>
          ))}
        </div>
        {askWake ? (
          <div>
            <p className="mut sheet-sub">Was waking at {clock(wakeLog.minutes)} right?</p>
            <div className="seg" role="group" aria-label="Wake-up time feedback">
              {([['early', 'Too early'], ['right', 'About right'], ['late', 'Too late']] as const).map(([k, l]) => (
                <button type="button" key={k} aria-pressed={fb === k} onClick={() => setFb(fb === k ? undefined : k)}>{l}</button>
              ))}
            </div>
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
