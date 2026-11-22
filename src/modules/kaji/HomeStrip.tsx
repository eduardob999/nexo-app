import { useState } from 'react';
import { mealsAtHome, presenceNow } from './home';
import { t } from './i18n';
import type { Lang } from './model';
import { clockLabel } from './time';
import type { KajiActions, KajiData } from './ui';
import { memberColor } from './view';

/**
 * Who is home, with a Go out / Back home button for each person, and which of today's meals are eaten at home. His request, 2026-11-21:
 * "there should be a go out, get back button but it also sounds work with our schedules". The calendars are the default; a press
 * overrides them, and the planner plans washing and cooking only for the meals someone eats at home.
 */
export function HomeStrip({ data, actions, lang }: { data: KajiData; actions: KajiActions; lang: Lang }) {
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const meals = mealsAtHome(data.now, data.members, data.busy, data.presence, data.settings);
  const who = (home: string[]) => (home.length === 0 ? t(lang, 'eatOut') : home.length === data.members.length && home.length > 1 ? t(lang, 'both') : home.map((u) => data.members.find((m) => m.uid === u)?.name ?? '').join(', '));
  const press = async (uid: string, out: boolean) => {
    setBusyUid(uid);
    try { await actions.setPresence(uid, out); } finally { setBusyUid(null); }
  };
  return (
    <>
      <ul className="kaji-list panel" aria-label={t(lang, 'whoIsHome')}>
        {data.members.map((m, i) => {
          const p = presenceNow(data.busy[m.uid], data.presence[m.uid], data.now);
          const status = p.out ? `${t(lang, 'outUntil')} ${p.until ? clockLabel(p.until) : ''}${p.by === 'calendar' ? ` · ${t(lang, 'byCalendar')}` : ''}` : t(lang, 'atHome');
          return (
            <li key={m.uid} className="kaji-item">
              <i className="kaji-dot" style={{ background: memberColor(i) }} />
              <span className="kaji-main"><b>{m.name}{m.uid === data.me ? ` (${t(lang, 'you')})` : ''}</b><small className="mut">{status}</small></span>
              <button className={p.out ? 'copy-main' : 'chip-btn'} disabled={busyUid === m.uid} onClick={() => void press(m.uid, !p.out)}>{p.out ? t(lang, 'backHome') : t(lang, 'goOut')}</button>
            </li>
          );
        })}
        <li className="kaji-item">
          <span className="kaji-main"><small className="mut">{t(lang, 'mealsAtHome')}: {meals.map((x) => `${t(lang, ['breakfast', 'lunch', 'dinner'][x.meal] ?? '')} ${who(x.home)}`).join(' · ')}</small></span>
        </li>
      </ul>
    </>
  );
}
