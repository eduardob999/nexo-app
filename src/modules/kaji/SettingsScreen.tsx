import { useEffect, useState } from 'react';
import { historyLine, learnedLine } from './history';
import { learnShifts } from './reschedule';
import { watchHistory, type HistoryEntry } from './store';
import { InviteCard } from './Setup';
import { t } from './i18n';
import type { Lang, Settings } from './model';
import { DAY } from './time';
import type { KajiActions, KajiData } from './ui';

export function SettingsScreen({ data, actions, lang, link }: { data: KajiData; actions: KajiActions; lang: Lang; link: string }) {
  const s = data.settings;
  const other = data.members.find((m) => m.uid !== data.me);
  const myShare = Math.round(((s.targets?.[data.me] ?? 1) / ((s.targets?.[data.me] ?? 1) + (other ? s.targets?.[other.uid] ?? 1 : 0))) * 100) || 50;
  const [date, setDate] = useState('');
  const learned = learnShifts(data.tasks, data.log, data.now);
  const [hist, setHist] = useState<HistoryEntry[]>([]);
  useEffect(() => (data.hid === 'h' ? undefined : watchHistory(data.hid, setHist)), [data.hid]);
  const awayUntil = data.away[data.me];
  const away = awayUntil && awayUntil > data.now;
  const save = (p: Partial<Settings>) => void actions.saveSettings({ ...s, ...p });
  const num = (v: string, d: number) => Math.max(0, Number(v) || d);
  const days = (n: number) => { const d = new Date(data.now + n * DAY); d.setHours(23, 59, 0, 0); return d.getTime(); };
  return (
    <>
      <div className="panel settings secret-form">
        {other ? (
          <label className="setting kaji-slider"><span>{t(lang, 'share')}: {data.members.find((m) => m.uid === data.me)?.name} {myShare}% / {other.name} {100 - myShare}%</span>
            <input type="range" min={20} max={80} step={5} value={myShare} onChange={(e) => { const v = Number(e.target.value); save({ targets: { [data.me]: v, [other.uid]: 100 - v } }); }} aria-label={t(lang, 'share')} /></label>
        ) : null}
        <label className="setting"><span>{t(lang, 'buffer')}</span><input inputMode="numeric" value={s.bufferMin} onChange={(e) => save({ bufferMin: num(e.target.value, 15) })} style={{ maxWidth: 80 }} /></label>
        <label className="setting"><span>{t(lang, 'freeze')}</span><input inputMode="numeric" value={s.freezeMin} onChange={(e) => save({ freezeMin: num(e.target.value, 120) })} style={{ maxWidth: 80 }} /></label>
        <div className="setting"><span>{t(lang, 'slot')}</span><span className="kaji-row"><input type="time" value={s.slot.from} onChange={(e) => save({ slot: { ...s.slot, from: e.target.value } })} /><input type="time" value={s.slot.to} onChange={(e) => save({ slot: { ...s.slot, to: e.target.value } })} /></span></div>
        <div className="setting"><span>{t(lang, 'quiet')}</span><span className="kaji-row"><input type="time" value={s.quiet.from} onChange={(e) => save({ quiet: { ...s.quiet, from: e.target.value } })} /><input type="time" value={s.quiet.to} onChange={(e) => save({ quiet: { ...s.quiet, to: e.target.value } })} /></span></div>
        <label className="setting kaji-slider"><span>{t(lang, 'burden')}: ×{(s.burdenA + s.burdenB * 5).toFixed(1)}</span>
          <input type="range" min={0} max={0.4} step={0.05} value={s.burdenB} onChange={(e) => { const b = Number(e.target.value); save({ burdenB: b, burdenA: Math.round((1.2 - 3 * b) * 100) / 100 }); }} aria-label={t(lang, 'burden')} /></label>
      </div>
      <h2 className="group-title">{t(lang, 'away')}</h2>
      <div className="panel settings secret-form">
        {away ? (
          <div className="setting"><span>{t(lang, 'out')} {new Date(awayUntil as number).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span><button className="copy-main" onClick={() => void actions.setAway(null)}>{t(lang, 'back')}</button></div>
        ) : (
          <>
            <div className="setting"><span>{t(lang, 'out')}</span><span className="kaji-chips">{[1, 2, 3, 7].map((n) => <button key={n} className="chip-btn" onClick={() => void actions.setAway(days(n))}>{n}{'d'}</button>)}</span></div>
            <div className="setting"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /><button className="chip-btn" disabled={!date} onClick={() => { const d = new Date(date + 'T23:59:00'); void actions.setAway(d.getTime()); setDate(''); }}>{t(lang, 'save')}</button></div>
          </>
        )}
      </div>
      {hist.length || learned.length ? (
        <>
          <h2 className="group-title">{t(lang, 'history')}</h2>
          <ul className="kaji-list panel">
            {learned.map((l) => <li key={l.taskId + l.kind} className="kaji-item"><span className="kaji-main"><b style={{ fontWeight: 500 }}>{learnedLine(l, data.tasks, lang)}</b><small className="mut">{t(lang, 'learnedTitle')}</small></span></li>)}
            {hist.slice(0, 15).map((h) => (
              <li key={h.id} className="kaji-item"><span className="kaji-main"><b style={{ fontWeight: 500 }}>{historyLine(h, data.tasks, data.members, lang)}</b><small className="mut">{new Date(h.at + 9 * 3_600_000).toISOString().slice(5, 16).replace('T', ' ')}</small></span></li>
            ))}
          </ul>
        </>
      ) : null}
      {data.house.members[data.me] === 'owner' ? <InviteCard lang={lang} link={link} onInvite={actions.invite} /> : null}
    </>
  );
}
