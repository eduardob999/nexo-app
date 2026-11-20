import { useState } from 'react';
import { t } from './i18n';
import { readingFor, readingsOn } from './readings';
import type { Lang, PlannedItem } from './model';
import { candidateSlots } from './planner';
import { clockLabel, dayStart, DAY } from './time';
import type { KajiActions, KajiData } from './ui';
import { groupByDay, isDone, memberColor, taskName } from './view';

const WD = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], ja: ['日', '月', '火', '水', '木', '金', '土'] } as const;

export function WeekScreen({ data, lang, actions }: { data: KajiData; lang: Lang; actions: KajiActions }) {
  const [open, setOpen] = useState<PlannedItem | null>(null);
  const byId = new Map(data.tasks.map((x) => [x.id, x]));
  const end = dayStart(data.now) + 7 * DAY;
  const items = data.plan.filter((i) => i.end > data.now && i.start < end && !isDone(i, data.log, data.now));
  const days = groupByDay(items);
  return (
    <>
      <div className="kaji-legend">
        {data.members.map((m, i) => <span key={m.uid}><i className="kaji-dot" style={{ background: memberColor(i) }} /> {m.name}</span>)}
      </div>
      {days.map(({ day, items: list }) => {
        const d = new Date(day + 'T00:00:00Z');
        return (
          <section key={day}>
            <h2 className="group-title">{WD[lang][d.getUTCDay()]} {d.getUTCDate()}</h2>
            <ul className="kaji-list panel">
              {list.map((i) => {
                const task = byId.get(i.taskId);
                const idx = data.members.findIndex((m) => m.uid === i.uid);
                return task ? (
                  <li key={i.id} className="kaji-item kaji-tap" role="button" tabIndex={0} onClick={() => setOpen(i)} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(i); }}>
                    <i className="kaji-bar" style={{ background: memberColor(idx) }} />
                    <span className="kaji-ic">{task.icon}</span>
                    <span className="kaji-main"><b>{taskName(task, lang)}</b>{readingFor(task, lang, readingsOn()) ? <small className="kaji-rt">{readingFor(task, lang, readingsOn())}</small> : null}<small className="mut">{clockLabel(i.start)}–{clockLabel(i.end)} · {data.members[idx]?.name}{i.pinned ? ` · 📌 ${t(lang, 'pinned')}` : ''}</small></span>
                  </li>
                ) : null;
              })}
            </ul>
          </section>
        );
      })}
      {open ? <MoveSheet data={data} lang={lang} item={open} onClose={() => setOpen(null)} onPick={(uid, start) => { void actions.move(open, uid, start); setOpen(null); }} /> : null}
      {days.length === 0 ? <div className="panel kaji-empty"><b>{t(lang, 'nothingToday')}</b></div> : null}
    </>
  );
}

function MoveSheet({ data, lang, item, onPick, onClose }: { data: KajiData; lang: Lang; item: PlannedItem; onPick: (uid: string, start: number) => void; onClose: () => void }) {
  const task = data.tasks.find((x) => x.id === item.taskId);
  const slots = candidateSlots({ now: data.now, horizonDays: 7, tasks: data.tasks, members: data.members, estimates: data.estimates, log: data.log, busy: data.busy, existing: data.plan, settings: data.settings, awayUntil: data.away }, item);
  const wd = WD[lang];
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet kaji-sheet" role="dialog" aria-label={t(lang, 'moveTitle')} onClick={(e) => e.stopPropagation()}>
        <span className="grab" />
        <div><b className="sheet-title">{task?.icon} {taskName(task, lang, item.taskId)}</b><p className="mut sheet-sub">{t(lang, 'moveTitle')} · {clockLabel(item.start)}</p></div>
        {slots.length === 0 ? <p className="mut">{t(lang, 'noSlots')}</p> : (
          <div className="kaji-pick">
            {slots.map((s) => {
              const d = new Date(dayStart(s.start) + 9 * 3_600_000);
              const idx = data.members.findIndex((m) => m.uid === s.uid);
              return (
                <button key={s.uid + s.start} type="button" className="kaji-pickrow" onClick={() => onPick(s.uid, s.start)}>
                  <i className="kaji-dot" style={{ background: memberColor(idx) }} /><span><b>{wd[d.getUTCDay()]} {d.getUTCDate()}</b> · {clockLabel(s.start)}–{clockLabel(s.end)} · {data.members[idx]?.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
