import { useState } from 'react';
import { Face } from '../../SleepFeedback';
import { CATEGORY_COLOR } from './catalog';
import { CATEGORY_LABEL, faces, t } from './i18n';
import type { Category, Lang, TaskType } from './model';
import type { KajiActions, KajiData } from './ui';
import { blankTask, slug } from './quicklog';
import { taskName } from './view';

const CATS = Object.keys(CATEGORY_LABEL) as Category[];

const blank = blankTask;

/** The catalog, every field editable. Edits are saved with who made them. */
export function ChoresScreen({ data, actions, lang }: { data: KajiData; actions: KajiActions; lang: Lang }) {
  const [edit, setEdit] = useState<{ task: TaskType; isNew: boolean } | null>(null);
  const [survey, setSurvey] = useState(false);
  const mine = data.survey[data.me] ?? {};
  const unanswered = data.tasks.filter((x) => x.active && mine[x.id] === undefined).length;
  return (
    <>
      <div className="panel kaji-chorebar">
        <button className="copy-main" onClick={() => setEdit({ task: blank(), isNew: true })}>+ {t(lang, 'add')}</button>
        <button className="chip-btn" onClick={() => setSurvey(true)}>{t(lang, 'baseline')}{unanswered ? ` (${unanswered})` : ''}</button>
      </div>
      <ul className="kaji-list panel">
        {data.tasks.map((x) => (
          <li key={x.id} className={`kaji-item ${x.active ? '' : 'kaji-dim'}`}>
            <i className="kaji-bar" style={{ background: CATEGORY_COLOR[x.category] }} />
            <span className="kaji-ic">{x.icon}</span>
            <span className="kaji-main"><b>{taskName(x, lang)}</b>
              <small className="mut">{x.freq.adhoc ? t(lang, 'adhoc') : `${x.freq.times} ${t(lang, 'times')} ${x.freq.perDays} ${t(lang, 'days')}`} · {x.mode === 'fixed' ? t(lang, 'modeFixed') : `${x.priorMinutes} ${t(lang, 'minutes')}`}</small></span>
            <button className="chip-btn" onClick={() => setEdit({ task: x, isNew: false })}>{t(lang, 'edit')}</button>
          </li>
        ))}
      </ul>
      {edit ? <EditSheet lang={lang} data={data} task={edit.task} isNew={edit.isNew} onClose={() => setEdit(null)}
        onSave={(task) => { void actions.saveTask(task, edit.isNew ? undefined : edit.task); setEdit(null); }} /> : null}
      {survey ? <Survey lang={lang} data={data} onClose={() => setSurvey(false)} onSave={(a) => { void actions.saveSurvey(a); setSurvey(false); }} /> : null}
    </>
  );
}

function EditSheet({ lang, data, task, isNew, onSave, onClose }: { lang: Lang; data: KajiData; task: TaskType; isNew: boolean; onSave: (t: TaskType) => void; onClose: () => void }) {
  const [x, setX] = useState<TaskType>(task);
  const set = (p: Partial<TaskType>) => setX({ ...x, ...p });
  const num = (v: string, d: number) => (v === '' ? d : Math.max(0, Number(v) || 0));
  const valid = x.names.en.trim();
  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet kaji-sheet kaji-edit" role="dialog" aria-label={t(lang, 'edit')} onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); const names = { ...x.names, en: x.names.en.trim() };
          onSave({ ...x, names, id: x.id || `${slug(names.en)}-${Date.now().toString(36).slice(-3)}` }); }}>
        <span className="grab" />
        <b className="sheet-title">{isNew ? t(lang, 'add') : t(lang, 'edit')}</b>
        <label className="kaji-field"><span>{t(lang, 'name')}</span><input value={x.names.en} onChange={(e) => set({ names: { ...x.names, en: e.target.value } })} /></label>
        <div className="kaji-row">
          <label className="kaji-field"><span>{t(lang, 'icon')}</span><input value={x.icon} maxLength={4} onChange={(e) => set({ icon: e.target.value })} style={{ width: 64 }} /></label>
          <label className="kaji-field"><span>{t(lang, 'category')}</span>
            <select value={x.category} onChange={(e) => set({ category: e.target.value as Category })}>{CATS.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select></label>
        </div>
        <div className="kaji-field"><span>{t(lang, 'every')}</span>
          <div className="kaji-row">
            <input inputMode="numeric" value={x.freq.adhoc ? 0 : x.freq.times} onChange={(e) => { const times = num(e.target.value, 1); set({ freq: { ...x.freq, times, adhoc: times === 0 } }); }} aria-label={t(lang, 'times')} style={{ width: 60 }} />
            <span>{t(lang, 'times')}</span>
            <input inputMode="numeric" value={x.freq.perDays} onChange={(e) => set({ freq: { ...x.freq, perDays: Math.max(1, num(e.target.value, 1)) } })} aria-label={t(lang, 'days')} style={{ width: 60 }} />
            <span>{t(lang, 'days')}</span>
          </div>
        </div>
        <div className="kaji-field"><span>{t(lang, 'mode')}</span>
          <div className="seg" role="group"><button type="button" aria-pressed={x.mode === 'measured'} onClick={() => set({ mode: 'measured' })} style={{ textTransform: 'none' }}>{t(lang, 'modeMeasured')}</button>
            <button type="button" aria-pressed={x.mode === 'fixed'} onClick={() => set({ mode: 'fixed', window: x.window ?? { from: '18:00', to: '20:00' } })} style={{ textTransform: 'none' }}>{t(lang, 'modeFixed')}</button></div></div>
        <label className="kaji-field"><span>{t(lang, 'priorMinutes')}</span><input inputMode="numeric" value={x.priorMinutes} onChange={(e) => set({ priorMinutes: Math.max(1, num(e.target.value, 10)) })} style={{ width: 90 }} /></label>
        {x.mode === 'fixed' || x.window ? (
          <div className="kaji-row">
            <label className="kaji-field"><span>{t(lang, 'windowFrom')}</span><input type="time" value={x.window?.from ?? '18:00'} onChange={(e) => set({ window: { from: e.target.value, to: x.window?.to ?? '20:00' } })} /></label>
            <label className="kaji-field"><span>{t(lang, 'windowTo')}</span><input type="time" value={x.window?.to ?? '20:00'} onChange={(e) => set({ window: { from: x.window?.from ?? '18:00', to: e.target.value } })} /></label>
          </div>
        ) : null}
        <div className="kaji-field"><span>{t(lang, 'allowed')}</span>
          <div className="kaji-chips">
            <button type="button" className="chip-btn" aria-pressed={!x.who?.length} onClick={() => { set({ who: [] }); }}>{t(lang, 'everyone')}</button>
            {data.members.map((m) => <button type="button" key={m.uid} className="chip-btn" aria-pressed={!!x.who?.includes(m.uid)}
              onClick={() => { const cur = new Set(x.who ?? []); cur.has(m.uid) ? cur.delete(m.uid) : cur.add(m.uid); set({ who: [...cur] }); }}>{m.name}</button>)}
          </div>
        </div>
        <label className="kaji-field kaji-check"><input type="checkbox" checked={x.active} onChange={(e) => set({ active: e.target.checked })} /> <span>{t(lang, 'active')}</span></label>
        <div className="sheet-foot"><button type="button" className="chip-btn" onClick={onClose}>{t(lang, 'skip')}</button><button type="submit" className="copy-main" disabled={!valid}>{t(lang, 'save')}</button></div>
      </form>
    </div>
  );
}

/** One tap per chore: how much do you mind it. Saved once, refined by the ratings afterwards. */
function Survey({ lang, data, onSave, onClose }: { lang: Lang; data: KajiData; onSave: (a: Record<string, number>) => void; onClose: () => void }) {
  const [a, setA] = useState<Record<string, number>>(data.survey[data.me] ?? {});
  const list = data.tasks.filter((x) => x.active);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet kaji-sheet kaji-edit" role="dialog" aria-label={t(lang, 'baseline')} onClick={(e) => e.stopPropagation()}>
        <span className="grab" />
        <div><b className="sheet-title">{t(lang, 'baseline')}</b><p className="mut sheet-sub">{t(lang, 'baselineAbout')}</p></div>
        {list.map((x) => (
          <div key={x.id} className="kaji-survey">
            <span>{x.icon} {taskName(x, lang)}</span>
            <div className="faces kaji-mini" role="radiogroup" aria-label={taskName(x, lang)}>
              {faces(lang, 'facesMind').map((w, i) => (
                <button type="button" key={w} role="radio" aria-checked={a[x.id] === i + 1} title={w} className={`face ${a[x.id] === i + 1 ? 'on' : ''}`} onClick={() => setA({ ...a, [x.id]: i + 1 })}><Face v={5 - i} size={22} /></button>
              ))}
            </div>
          </div>
        ))}
        <div className="sheet-foot"><button type="button" className="chip-btn" onClick={onClose}>{t(lang, 'skip')}</button><button type="button" className="copy-main" onClick={() => onSave(a)}>{t(lang, 'save')}</button></div>
      </div>
    </div>
  );
}
