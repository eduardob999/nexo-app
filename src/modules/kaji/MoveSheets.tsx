import { useState } from 'react';
import { t } from './i18n';
import { REASONS, type Lang, type PlannedItem, type Reason, type Settings, type TaskType } from './model';
import { reasonValid, rescheduleOptions } from './reschedule';
import type { Slot } from './planner';
import { clockLabel, DAY, dayKey, weekday } from './time';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const reasonLabel = (lang: Lang, r: Reason) => t(lang, 'reason' + r.charAt(0).toUpperCase() + r.slice(1));

function Chips({ lang, value, onPick, list }: { lang: Lang; value: Reason | null; onPick: (r: Reason | null) => void; list: Reason[] }) {
  return (
    <div className="kaji-chips" role="radiogroup">
      {list.map((r) => <button type="button" key={r} role="radio" aria-checked={value === r} aria-pressed={value === r} className="chip-btn" onClick={() => onPick(value === r ? null : r)}>{reasonLabel(lang, r)}</button>)}
    </div>
  );
}

/**
 * "Let Nexo pick" is the first and default choice: the planner finds the nearest free time for whoever may do the chore (`nexo`, null when
 * nothing is free). The manual choices (later, evening, tomorrow, a picked time) stay below it. A reason can be added and is never required.
 */
export function RescheduleSheet({ lang, task, item, now, settings, nexo = null, nexoWho, onPick, onCancel }: { lang: Lang; task: TaskType; item: PlannedItem; now: number; settings: Settings; nexo?: Slot | null; nexoWho?: string; onPick: (start: number, reason: Reason | null, note: string, toUid?: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState('');
  const [custom, setCustom] = useState('');
  const opts = rescheduleOptions(item, now, settings);
  const label = (id: string, start: number) => `${t(lang, id === 'later' ? 'laterToday' : id === 'evening' ? 'thisEvening' : id === 'weekend' ? 'nextWeekend' : 'tomorrow')} · ${WD[weekday(start)]} ${clockLabel(start)}`;
  const customMs = custom ? Date.parse(`${custom}:00+09:00`) : NaN;
  const customOk = Number.isFinite(customMs) && customMs > now;
  const go = (start: number, toUid?: string) => onPick(start, reason, reason === 'other' ? note.trim() : '', toUid);
  return (
    <div className="scrim" onClick={onCancel}>
      <div className="sheet kaji-sheet" role="dialog" aria-label={t(lang, 'reschedule')} onClick={(e) => e.stopPropagation()}>
        <span className="grab" />
        <b className="sheet-title">{task.icon} {task.names[lang] || task.names.en}</b>
        <p className="mut sheet-sub">{t(lang, 'rescheduleAbout')}</p>
        {nexo ? (
          <div className="kaji-pick">
            <button type="button" className="copy-main" onClick={() => go(nexo.start, nexo.uid !== item.uid ? nexo.uid : undefined)}>{t(lang, 'letNexoPick')} · {dayKey(nexo.start) === dayKey(now) ? '' : `${WD[weekday(nexo.start)]} `}{clockLabel(nexo.start)}{nexoWho ? ` · ${nexoWho}` : ''}</button>
          </div>
        ) : null}
        {nexo ? <p className="mut sheet-sub">{t(lang, 'orPickYourself')}</p> : null}
        <div className="kaji-pick">
          {opts.map((o, n) => <button type="button" key={o.id} className={n === 0 && !nexo ? 'copy-main' : 'chip-btn'} onClick={() => go(o.start)}>{label(o.id, o.start)}</button>)}
        </div>
        <label className="kaji-field"><span>{t(lang, 'pickTime')}</span>
          <span className="kaji-row"><input type="datetime-local" value={custom} min={`${dayKey(now)}T00:00`} max={`${dayKey(now + 6 * DAY)}T23:59`} onChange={(e) => setCustom(e.target.value)} />
            <button type="button" className="chip-btn" disabled={!customOk} onClick={() => go(customMs)}>{t(lang, 'setTime')}</button></span></label>
        <p className="mut sheet-sub">{t(lang, 'whyOptional')}</p>
        <Chips lang={lang} value={reason} onPick={setReason} list={REASONS.filter((r) => r !== 'dislike')} />
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
        {reason === 'dislike' ? <p className="mut sheet-sub" role="note">{t(lang, 'karmaNote')}</p> : null}
        <input className="kaji-text" maxLength={200} value={note} placeholder={t(lang, 'reasonText')} onChange={(e) => setNote(e.target.value)} />
        <div className="sheet-foot">
          <button type="button" className="chip-btn" onClick={onCancel}>{t(lang, 'cancel')}</button>
          <button type="button" className="copy-main" disabled={!ok} onClick={() => reason && onConfirm(reason, note.trim())}>{t(lang, 'confirmDismiss')}</button>
        </div>
      </div>
    </div>
  );
}
