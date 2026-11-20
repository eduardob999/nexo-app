import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModuleProps } from '../types';
import { estimateFor } from './adapt';
import { BalanceScreen } from './BalanceScreen';
import { ChoresScreen } from './ChoresScreen';
import { t } from './i18n';
import { DEFAULT_SETTINGS, type Interval, type Lang, type LogEvent, type PlannedItem, type Settings, type TaskType } from './model';
import { plan as makePlan, type Unplaced } from './planner';
import { SettingsScreen } from './SettingsScreen';
import { Setup } from './Setup';
import { addNotToday, answerSwap, clearAway, createHousehold, invite, join, logEvent, members as membersOf, proposeSwap, saveSettings, saveSurvey, savePlan, saveTask, setAway,
  watchAway, watchBusy, watchHousehold, watchLog, watchMyHousehold, watchNotToday, watchPlan, watchSettings, watchSurvey, watchSwaps, watchTasks,
  type BusyDoc, type HouseholdDoc, type NotToday, type PlanDoc, type Swap } from './store';
import { dayKey, MIN, weekday } from './time';
import { TodayScreen } from './TodayScreen';
import type { KajiActions, KajiData } from './ui';
import { WeekScreen } from './WeekScreen';

export { kajiManifest } from './manifest';

type Tab = 'today' | 'week' | 'balance' | 'chores' | 'more';
const TABS: Tab[] = ['today', 'week', 'balance', 'chores', 'more'];

export function initialLang(): Lang {
  try {
    const s = window.localStorage.getItem('kaji.lang');
    if (s === 'en' || s === 'es' || s === 'ja') return s;
  } catch { /* private mode */ }
  const n = (navigator.language || 'en').slice(0, 2);
  return n === 'es' || n === 'ja' ? n : 'en';
}

/** The screens, with no Firebase in them: the live module and the preview both feed this. */
export function KajiView({ data, actions, lang, onLang, link, tab: forced }: { data: KajiData; actions: KajiActions; lang: Lang; onLang: (l: Lang) => void; link: string; tab?: Tab }) {
  const [tab, setTab] = useState<Tab>(forced ?? 'today');
  return (
    <main className="screen kaji">
      <header className="top"><div><span className="kicker">{t(lang, 'kaji').toUpperCase()} · 家事</span><h1>{t(lang, 'kajiSub')}</h1></div></header>
      <div className="seg kaji-tabs" role="tablist">
        {TABS.map((k) => <button key={k} role="tab" aria-pressed={tab === k} onClick={() => setTab(k)} style={{ textTransform: 'none' }}>{t(lang, k)}</button>)}
      </div>
      {tab === 'today' ? <TodayScreen data={data} actions={actions} lang={lang} /> : null}
      {tab === 'week' ? <WeekScreen data={data} lang={lang} /> : null}
      {tab === 'balance' ? <BalanceScreen data={data} lang={lang} /> : null}
      {tab === 'chores' ? <ChoresScreen data={data} actions={actions} lang={lang} /> : null}
      {tab === 'more' ? <SettingsScreen data={data} actions={actions} lang={lang} onLang={onLang} link={link} /> : null}
    </main>
  );
}

/** Everything the planner needs, kept live, and the plan written back whenever it changes. */
function useKaji(uid: string): { hid: string | null | undefined; data: KajiData | null; actions: KajiActions | null } {
  const [hid, setHid] = useState<string | null | undefined>(undefined);
  const [house, setHouse] = useState<HouseholdDoc | null>(null);
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [log, setLog] = useState<LogEvent[]>([]);
  const [survey, setSurvey] = useState<Record<string, Record<string, number>>>({});
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [away, setAwayState] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<BusyDoc | null>(null);
  const [planDoc, setPlanDoc] = useState<PlanDoc | null>(null);
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [notToday, setNotToday] = useState<NotToday[]>([]);
  const [slot, setSlot] = useState(() => Math.floor(Date.now() / (5 * MIN)));
  useEffect(() => watchMyHousehold(uid, setHid), [uid]);
  useEffect(() => { const i = window.setInterval(() => setSlot(Math.floor(Date.now() / (5 * MIN))), 60_000); return () => window.clearInterval(i); }, []);
  useEffect(() => {
    if (!hid) return undefined;
    const subs = [watchHousehold(hid, setHouse), watchTasks(hid, setTasks), watchLog(hid, setLog), watchSurvey(hid, setSurvey), watchSettings(hid, setSettings), watchAway(hid, setAwayState),
      watchBusy(hid, setBusy), watchPlan(hid, setPlanDoc), watchSwaps(hid, setSwaps), watchNotToday(hid, setNotToday)];
    return () => subs.forEach((u) => u());
  }, [hid]);

  const members = useMemo(() => membersOf(house), [house]);
  const estimates = useMemo(() => Object.fromEntries(tasks.map((x) => [x.id, estimateFor(x, log, survey, members)])), [tasks, log, survey, members]);
  const existing = useRef<PlannedItem[]>([]);
  existing.current = planDoc?.items ?? [];
  const [computed, setComputed] = useState<{ items: PlannedItem[]; unplaced: Unplaced[] }>({ items: [], unplaced: [] });
  const lastSaved = useRef('');
  useEffect(() => {
    if (!hid || !house || tasks.length === 0 || members.length === 0) return undefined;
    const handle = window.setTimeout(() => {
      const now = slot * 5 * MIN;
      const busyBy: Record<string, Interval[]> = busy?.events ?? {};
      const today = dayKey(now);
      const declines = swaps.filter((s) => s.state === 'declined').map((s) => ({ uid: s.toUid, taskId: s.taskId, dow: weekday(s.start) }));
      const out = makePlan({ now, horizonDays: 7, tasks, members, estimates, log, busy: busyBy, existing: existing.current, settings, awayUntil: away, notToday: notToday.filter((n) => n.day >= today), declines });
      setComputed({ items: out.items, unplaced: out.unplaced });
      const sig = JSON.stringify(out.items.map((i) => [i.id, i.uid, i.start, i.pinned ? 1 : 0]));
      if (sig !== lastSaved.current && sig !== JSON.stringify(existing.current.map((i) => [i.id, i.uid, i.start, i.pinned ? 1 : 0]))) { lastSaved.current = sig; void savePlan(hid, uid, out.items); }
    }, 1200);
    return () => window.clearTimeout(handle);
  }, [hid, house, tasks, members, estimates, log, busy, settings, away, swaps, notToday, slot, uid]);

  const actions = useMemo<KajiActions | null>(() => {
    if (!hid) return null;
    return {
      logDone: async (taskId, minutes, r, o) => { await logEvent(hid, { taskId, uid, kind: 'done', at: Date.now(), minutes, planned: o?.planned ?? false, ...(o?.start !== undefined ? { start: o.start } : {}), ...(r.effort ? { effort: r.effort } : {}), ...(r.dislike ? { dislike: r.dislike } : {}), ...(r.enjoyment ? { enjoyment: r.enjoyment } : {}) }); },
      undo: async () => {},
      notToday: async (item) => addNotToday(hid, uid, item.taskId, dayKey(item.start)),
      askSwap: async (item, to) => proposeSwap(hid, item, to),
      answerSwap: async (s, accept) => {
        await answerSwap(hid, s.id, accept ? 'accepted' : 'declined');
        if (accept) await savePlan(hid, uid, existing.current.map((i) => (i.id === s.itemId ? { ...i, uid: s.toUid, pinned: true } : i)));
      },
      saveTask: async (task, before) => saveTask(hid, uid, task, before),
      saveSettings: async (s) => saveSettings(hid, uid, s, settings),
      saveSurvey: async (a) => saveSurvey(hid, uid, a),
      setAway: async (until) => (until === null ? clearAway(hid, uid) : setAway(hid, uid, until)),
      invite: async (email) => invite(hid, email, uid),
    };
  }, [hid, uid, settings]);

  const data = useMemo<KajiData | null>(() => (hid && house && members.length ? {
    hid, me: uid, house, members, tasks, log, survey, settings, away, busy: busy?.events ?? {}, plan: computed.items, unplaced: computed.unplaced, swaps, estimates, now: slot * 5 * MIN,
  } : null), [hid, house, members, tasks, log, survey, settings, away, busy, computed, swaps, estimates, slot, uid]);
  return { hid, data, actions };
}

export function KajiModule({ uid, openId }: ModuleProps) {
  const { hid, data, actions } = useKaji(uid);
  const [lang, setLang] = useState<Lang>(() => initialLang());
  const changeLang = (l: Lang) => { setLang(l); try { window.localStorage.setItem('kaji.lang', l); } catch { /* private mode */ } };
  const joinHid = openId?.startsWith('join-') ? openId.slice(5) : null;
  const link = hid ? `${window.location.origin}${window.location.pathname}#/kaji/join-${hid}` : '';
  if (hid === undefined) return <main className="screen"><p className="empty">{t(lang, 'loading')}</p></main>;
  if (!hid || !data || !actions) {
    return (
      <main className="screen kaji">
        <header className="top"><div><span className="kicker">{t(lang, 'kaji').toUpperCase()} · 家事</span><h1>{t(lang, 'kajiSub')}</h1></div></header>
        <Setup lang={lang} onLang={changeLang} defaultName="" joinHid={hid ? null : joinHid}
          onCreate={async (name, me) => { await createHousehold(uid, name, me, lang); }}
          onJoin={async (h, me) => { await join(uid, h, me, lang); window.location.hash = '#/kaji'; }} />
      </main>
    );
  }
  return <KajiView data={data} actions={actions} lang={lang} onLang={changeLang} link={link} />;
}
