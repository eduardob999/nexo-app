import { t } from './i18n';
import type { Lang } from './model';
import { clockLabel, dayStart, DAY } from './time';
import type { KajiData } from './ui';
import { groupByDay, isDone, memberColor, taskName } from './view';

const WD = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], ja: ['日', '月', '火', '水', '木', '金', '土'] } as const;

export function WeekScreen({ data, lang }: { data: KajiData; lang: Lang }) {
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
                  <li key={i.id} className="kaji-item">
                    <i className="kaji-bar" style={{ background: memberColor(idx) }} />
                    <span className="kaji-ic">{task.icon}</span>
                    <span className="kaji-main"><b>{taskName(task, lang)}</b><small className="mut">{clockLabel(i.start)} to {clockLabel(i.end)} · {data.members[idx]?.name}{i.pinned ? ' · 📌' : ''}</small></span>
                  </li>
                ) : null;
              })}
            </ul>
          </section>
        );
      })}
      {days.length === 0 ? <div className="panel kaji-empty"><b>{t(lang, 'nothingToday')}</b></div> : null}
    </>
  );
}
