import { useState } from 'react';
import { t } from './i18n';
import { REASONS, type Lang, type PlannedItem, type Reason, type Settings, type TaskType } from './model';
import { reasonValid, rescheduleOptions } from './reschedule';
import { clockLabel, DAY, dayKey } from './time';

const reasonLabel = (lang: Lang, r: Reason) => t(lang, 'reason' + r.charAt(0).toUpperCase() + r.slice(1));

function Chips({ lang, value, onPick, list }: { lang: Lang; value: Reason | null; onPick: (r: Reason | null) => void; list: Reason[] }) {
  return (
    <div className="kaji-chips" role="radiogroup">
      {list.map((r) => <button type="button" key={r} role="radio" aria-checked={value === r} aria-pressed={value === r} className="chip-btn" onClick={() => onPick(value === r ? null : r)}>{reasonLabel(lang, r)}</button>)}
    </div>
  );
}

/** "Later today" is one tap; every other choice is a tap or a picked time. A reason can be added and is never required. */
export function RescheduleSheet({ lang, task, item, now, settings, onPick, onCancel }: { lang: Lang; task: TaskType; item: PlannedItem; now: number; settings: Settings; onPick: (start: number, reason: Reason | null, note: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState('');
  const [custom, setCustom] = useState('');
  const opts = rescheduleOptions(item, now, settings);
  const label = (id: string, start: number) => `${t(lang, id === 'later' ? 'laterToday' : id === 'evening' ? 'thisEvening' : 'tomorrow')} · ${clockLabel(start)}`;
  const customMs = custom ? Date.parse(`${custom}:00+09:00`) : NaN;
  const customOk = Number.isFinite(customMs) && customMs > now;
  const go = (start: number) => onPick(start, reason, reason === 'other' ? note.trim() : '');
  return (
    <div className="scrim" onClick={onCancel}>
      <div className="sheet kaji-sheet" role="dialog" aria-label={t(lang, 'reschedule')} onClick={(e) => e.stopPropagation()}>
        <span className="grab" />
        <b className="sheet-title">{task.icon} {task.names[lang] || task.names.en}</b>
        <p className="mut sheet-sub">{t(lang, 'rescheduleAbout')}</p>
        <div className="kaji-pick">
          {opts.map((o, n) => <button type="button" key={o.id} className={n === 0 ? 'copy-main' : 'chip-btn'} onClick={() => go(o.start)}>{label(o.id, o.start)}</button>)}
        </div>
        <label className="kaji-field"><span>{t(lang, 'pickTime')}</span>
          <span className="kaji-row"><input type="datetime-local" value={custom} min={`${dayKey(now)}T00:00`} max={`${dayKey(now + 6 * DAY)}T23:59`} onChange={(e) => setCustom(e.target.value)} />
            <button type="button" className="chip-btn" disabled={!customOk} onClick={() => go(customMs)}>{t(lang, 'setTime')}</button></span></label>
        <p className="mut sheet-sub">{t(lang, 'whyOptional')}</p>
        <Chips lang={lang} value={reason} onPick={setReason} list={REASONS} />
        {reason === 'other' ? <input className="kaji-text" maxLength={200} value={note} placeholder={t(lang, 'reasonText')} onChange={(e) => setNote(e.target.value)} /> : null}
        <div className="sheet-foot"><button type="button" className="chip-btn" onClick={onCancel}>{t(lang, 'cancel')}</button></div>
      </div>
    </div>
  );
}

/** A dismissal always says why: a preset, or "other" with words. The button stays off until it does. */
export function DismissSheet({ lang, task, onConfirm, onCancel }: { lang: Lang; task: TaskType; onConfirm: (reason: Reason, note: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState('');
  const ok = reasonValid(reason, note);
  return (
    <div className="scrim" onClick={onCancel}>
      <div className="sheet kaji-sheet" role="dialog" aria-label={t(lang, 'dismiss')} onClick={(e) => e.stopPropagation()}>
        <span className="grab" />
        <b className="sheet-title">{task.icon} {task.names[lang] || task.names.en}</b>
        <p className="mut sheet-sub">{t(lang, 'dismissAbout')}</p>
        <p className="mut sheet-sub">{t(lang, 'dismissWhy')}</p>
        <Chips lang={lang} value={reason} onPick={setReason} list={REASONS} />
        <input className="kaji-text" maxLength={200} value={note} placeholder={t(lang, 'reasonText')} onChange={(e) => setNote(e.target.value)} />
        <div className="sheet-foot">
          <button type="button" className="chip-btn" onClick={onCancel}>{t(lang, 'cancel')}</button>
          <button type="button" className="copy-main" disabled={!ok} onClick={() => reason && onConfirm(reason, note.trim())}>{t(lang, 'confirmDismiss')}</button>
        </div>
      </div>
    </div>
  );
}
