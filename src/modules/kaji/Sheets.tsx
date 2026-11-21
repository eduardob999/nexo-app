import { useState } from 'react';
import { Face } from '../../SleepFeedback';
import { faces, t } from './i18n';
import { CATEGORY_LABEL } from './i18n';
import type { Category, Lang, TaskType } from './model';
import { newTaskFrom, type Kind } from './quicklog';
import type { Ratings } from './ui';

/** Three faces, each optional, and one tap to skip them all. */
export function RateSheet({ lang, task, onSave, onSkip, initial, later }: { lang: Lang; task: TaskType; onSave: (r: Ratings) => void; onSkip: () => void; initial?: Ratings; later?: boolean }) {
  const [r, setR] = useState<Ratings>(initial ?? {});
  const row = (key: keyof Ratings, label: string, scale: 'facesHard' | 'facesMind' | 'facesLike') => (
    <div>
      <p className="mut sheet-sub">{label}</p>
      <div className="faces" role="radiogroup" aria-label={label}>
        {faces(lang, scale).map((w, i) => (
          <button type="button" key={w} role="radio" aria-checked={r[key] === i + 1} className={`face ${r[key] === i + 1 ? 'on' : ''}`}
            onClick={() => setR({ ...r, [key]: r[key] === i + 1 ? undefined : i + 1 } as Ratings)}><Face v={scale === 'facesLike' ? i + 1 : 5 - i} /><small>{w}</small></button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="scrim" onClick={onSkip}>
      <div className="sheet kaji-sheet" role="dialog" aria-label={t(lang, 'rateTitle')} onClick={(e) => e.stopPropagation()}>
        <span className="grab" />
        <b className="sheet-title">{task.icon} {task.names[lang]}</b>
        {row('effort', t(lang, 'effort'), 'facesHard')}
        {row('dislike', t(lang, 'mind'), 'facesMind')}
        {row('enjoyment', t(lang, 'enjoy'), 'facesLike')}
        <label className="kaji-field"><span>{t(lang, 'comment')}</span><textarea rows={2} maxLength={500} value={r.note ?? ''} placeholder={t(lang, 'commentHint')} onChange={(e) => setR({ ...r, note: e.target.value })} /></label>
        {later ? null : <p className="mut sheet-sub">{t(lang, 'rateLater')}</p>}
        <div className="sheet-foot">
          <button type="button" className="chip-btn" onClick={onSkip}>{t(lang, 'skip')}</button>
          <button type="button" className="copy-main" onClick={() => onSave(r)}>{t(lang, 'save')}</button>
        </div>
      </div>
    </div>
  );
}

/** "How long, about?" with the last answers as one-tap chips and a field for anything else. */
export function HowLongSheet({ lang, task, choices, onPick, onCancel }: { lang: Lang; task: TaskType; choices: number[]; onPick: (m: number) => void; onCancel: () => void }) {
  const [v, setV] = useState('');
  const n = Number(v);
  return (
    <div className="scrim" onClick={onCancel}>
      <form className="sheet kaji-sheet" role="dialog" aria-label={t(lang, 'howLong')} onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (n > 0) onPick(Math.round(n)); }}>
        <span className="grab" />
        <b className="sheet-title">{task.icon} {task.names[lang]}</b>
        <p className="mut sheet-sub">{t(lang, 'howLong')}</p>
        <div className="kaji-chips">
          {choices.map((m) => <button type="button" key={m} className="chip-btn" onClick={() => onPick(m)}>{m} {t(lang, 'minutes')}</button>)}
        </div>
        <div className="kaji-row">
          <input inputMode="numeric" pattern="[0-9]*" placeholder="25" value={v} onChange={(e) => setV(e.target.value.replace(/[^0-9]/g, ''))} aria-label={t(lang, 'minutes')} />
          <button type="submit" className="copy-main" disabled={!(n > 0)}>{t(lang, 'save')}</button>
        </div>
      </form>
    </div>
  );
}

/** Pick a chore that was done, planned or not. */
export function LogSheet({ lang, tasks, onPick, onCancel }: { lang: Lang; tasks: TaskType[]; onPick: (task: TaskType) => void; onCancel: () => void }) {
  return (
    <div className="scrim" onClick={onCancel}>
      <div className="sheet kaji-sheet" role="dialog" aria-label={t(lang, 'logAChore')} onClick={(e) => e.stopPropagation()}>
        <span className="grab" />
        <div><b className="sheet-title">{t(lang, 'logAChore')}</b><p className="mut sheet-sub">{t(lang, 'logAbout')}</p></div>
        <div className="kaji-pick">
          {tasks.filter((x) => x.active).map((x) => (
            <button key={x.id} type="button" className="kaji-pickrow" onClick={() => onPick(x)}><span className="kaji-ic">{x.icon}</span><span>{x.names[lang]}</span></button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The timer is stopped: what kind of task was it? One from the list, a new one, or a one-off. */
export function KindSheet({ lang, tasks, minutes, now, onPick, onCancel }: { lang: Lang; tasks: TaskType[]; minutes: number; now: number; onPick: (k: Kind) => void; onCancel: () => void }) {
  const [mode, setMode] = useState<'menu' | 'existing' | 'new' | 'custom'>('menu');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🧹');
  const [cat, setCat] = useState<Category>('rooms');
  const cats = Object.keys(CATEGORY_LABEL) as Category[];
  const ok = name.trim().length > 0;
  return (
    <div className="scrim" onClick={onCancel}>
      <div className="sheet kaji-sheet" role="dialog" aria-label={t(lang, 'whatDone')} onClick={(e) => e.stopPropagation()}>
        <span className="grab" />
        <div><b className="sheet-title">{t(lang, 'whatDone')}</b><p className="mut sheet-sub">{t(lang, 'tookMin')} {minutes} {t(lang, 'minutes')}</p></div>
        {mode === 'menu' ? (
          <div className="kaji-pick">
            <button type="button" className="kaji-pickrow" onClick={() => setMode('existing')}><span className="kaji-ic">📋</span><span>{t(lang, 'existingChore')}</span></button>
            <button type="button" className="kaji-pickrow" onClick={() => setMode('new')}><span className="kaji-ic">➕</span><span>{t(lang, 'newChore')}</span></button>
            <button type="button" className="kaji-pickrow" onClick={() => setMode('custom')}><span className="kaji-ic">✏️</span><span>{t(lang, 'customChore')}</span></button>
          </div>
        ) : null}
        {mode === 'existing' ? (
          <div className="kaji-pick">
            {tasks.filter((x) => x.active).map((x) => (
              <button key={x.id} type="button" className="kaji-pickrow" onClick={() => onPick({ kind: 'existing', taskId: x.id })}><span className="kaji-ic">{x.icon}</span><span>{x.names[lang] || x.names.en}</span></button>
            ))}
          </div>
        ) : null}
        {mode === 'new' || mode === 'custom' ? (
          <form className="kaji-form" onSubmit={(e) => { e.preventDefault(); if (!ok) return; onPick(mode === 'new' ? { kind: 'new', task: newTaskFrom(name, icon, cat, minutes, now) } : { kind: 'custom', name: name.trim() }); }}>
            <p className="mut sheet-sub">{t(lang, mode === 'new' ? 'newChoreHint' : 'customHint')}</p>
            <label className="kaji-field"><span>{t(lang, mode === 'new' ? 'name' : 'customName')}</span><input value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value)} /></label>
            {mode === 'new' ? (
              <div className="kaji-row">
                <label className="kaji-field"><span>{t(lang, 'icon')}</span><input value={icon} maxLength={4} onChange={(e) => setIcon(e.target.value)} style={{ width: 64 }} /></label>
                <label className="kaji-field"><span>{t(lang, 'category')}</span>
                  <select value={cat} onChange={(e) => setCat(e.target.value as Category)}>{cats.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select></label>
              </div>
            ) : null}
            <div className="sheet-foot"><button type="button" className="chip-btn" onClick={() => setMode('menu')}>{t(lang, 'back')}</button><button type="submit" className="copy-main" disabled={!ok}>{t(lang, 'saveLog')}</button></div>
          </form>
        ) : null}
        <div className="sheet-foot">
          {mode === 'existing' ? <button type="button" className="chip-btn" onClick={() => setMode('menu')}>{t(lang, 'back')}</button> : null}
          <button type="button" className="chip-btn" onClick={onCancel}>{t(lang, 'cancel')}</button>
        </div>
      </div>
    </div>
  );
}
