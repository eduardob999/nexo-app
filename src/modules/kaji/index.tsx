import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModuleProps } from '../types';
import { estimateFor } from './adapt';
import { migrateTasks } from './catalog';
import { BalanceScreen } from './BalanceScreen';
import { ChoresScreen } from './ChoresScreen';
import { ListsScreen } from './ListsScreen';
import { MoneyScreen } from './MoneyScreen';
import { t } from './i18n';
import { DEFAULT_SETTINGS, type Interval, type Lang, type LogEvent, type PlannedItem, type Settings, type TaskType } from './model';
import { applySwaps, plan as makePlan, type Unplaced } from './planner';
import { SettingsScreen } from './SettingsScreen';
import { Setup } from './Setup';
import { backHome, goOut, type Presence } from './home';
import { addNotToday, answerSwap, clearAway, createHousehold, invite, join, logEvent, members as membersOf, proposeSwap, rateEvent, sendAsk, saveSettings, saveSurvey, savePlan, saveTask, setAway, setPresence,
  watchAwayDocs, watchBusy, watchHousehold, watchLog, watchMyHousehold, watchNotToday, watchPlan, watchSettings, watchSurvey, watchSwaps, watchTasks,
  type BusyDoc, type HouseholdDoc, type NotToday, type PlanDoc, type Swap } from './store';
import { dayKey, MIN, weekday } from './time';
import { TodayScreen } from './TodayScreen';
import type { KajiActions, KajiData } from './ui';
import { WeekScreen } from './WeekScreen';

export { kajiManifest } from './manifest';

type Tab = 'today' | 'week' | 'balance' | 'chores' | 'lists' | 'money' | 'more';
const TABS: Tab[] = ['today', 'week', 'balance', 'chores', 'lists', 'money', 'more'];

/** Kaji is English only. */
export function initialLang(): Lang {
  return 'en';
}

/** The screens, with no Firebase in them: the live module and the preview both feed this. */
export function KajiView({ data, actions, lang, link, tab: forced, previewLists, previewLedger, previewAsks }: { data: KajiData; actions: KajiActions; lang: Lang; onLang?: (l: Lang) => void; link: string; tab?: Tab; previewLists?: { lists: import('./store').KList[]; items: import('./store').KItem[] }; previewLedger?: import('./ledger').LedgerEntry[]; previewAsks?: import('./asks').Ask[] }) {
  const [tab, setTab] = useState<Tab>(forced ?? 'today');
  return (
    <main className="screen kaji">
      <header className="top"><div><span className="kicker">KAJI</span><h1>{t(lang, 'kajiSub')}</h1></div></header>
      <div className="seg kaji-tabs" role="tablist">
        {TABS.map((k) => <button key={k} role="tab" aria-pressed={tab === k} onClick={() => setTab(k)} style={{ textTransform: 'none' }}>{t(lang, k)}</button>)}
      </div>
      {tab === 'today' ? <TodayScreen data={data} actions={actions} lang={lang} {...(previewAsks ? { askPreview: previewAsks } : {})} /> : null}
      {tab === 'week' ? <WeekScreen data={data} lang={lang} actions={actions} /> : null}
      {tab === 'balance' ? <BalanceScreen data={data} lang={lang} /> : null}
      {tab === 'chores' ? <ChoresScreen data={data} actions={actions} lang={lang} /> : null}
      {tab === 'lists' ? <ListsScreen data={data} lang={lang} {...(previewLists ? { preview: previewLists } : {})} /> : null}
      {tab === 'money' ? <MoneyScreen data={data} lang={lang} {...(previewLedger ? { preview: previewLedger } : {})} /> : null}
      {tab === 'more' ? <SettingsScreen data={data} actions={actions} lang={lang} link={link} /> : null}
    </main>
  );
}

/** Everything the planner needs, kept live, and the plan written back whenever it changes. */
export function useKaji(uid: string): { hid: string | null | undefined; data: KajiData | null; actions: KajiActions | null } {
  const [hid, setHid] = useState<string | null | undefined>(undefined);
  const [house, setHouse] = useState<HouseholdDoc | null>(null);
  const [storedTasks, setTasks] = useState<TaskType[]>([]);
  const [log, setLog] = useState<LogEvent[]>([]);
  const [survey, setSurvey] = useState<Record<string, Record<string, number>>>({});
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [awayDocs, setAwayDocs] = useState<Record<string, Presence>>({});
  // the planner's away-until map and the Go out / Back home presses come from the same documents
  const away = useMemo(() => Object.fromEntries(Object.entries(awayDocs).map(([u, d]) => [u, d.until ?? 0])), [awayDocs]);
  const [busy, setBusy] = useState<BusyDoc | null>(null);
  const [planDoc, setPlanDoc] = useState<PlanDoc | null>(null);
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [notToday, setNotToday] = useState<NotToday[]>([]);
  const [slot, setSlot] = useState(() => Math.floor(Date.now() / (5 * MIN)));
  useEffect(() => watchMyHousehold(uid, setHid), [uid]);
  useEffect(() => { const i = window.setInterval(() => setSlot(Math.floor(Date.now() / (5 * MIN))), 60_000); return () => window.clearInterval(i); }, []);
  useEffect(() => {
    if (!hid) return undefined;
    const subs = [watchHousehold(hid, setHouse), watchTasks(hid, setTasks), watchLog(hid, setLog), watchSurvey(hid, setSurvey), watchSettings(hid, setSettings), watchAwayDocs(hid, setAwayDocs),
      watchBusy(hid, setBusy), watchPlan(hid, setPlanDoc), watchSwaps(hid, setSwaps), watchNotToday(hid, setNotToday)];
    return () => subs.forEach((u) => u());
  }, [hid]);

  const members = useMemo(() => membersOf(house), [house]);
  // chores stored before a change in the seed are brought up to date on screen at once, and written back once by the owner (with a history line)
  const tasks = useMemo(() => migrateTasks(storedTasks), [storedTasks]);
  const migrated = useRef(new Set<string>());
  useEffect(() => {
    if (!hid || !house || house.members[uid] !== 'owner') return;
    tasks.forEach((x, i) => {
      const before = storedTasks[i];
      if (before && x !== before && !migrated.current.has(x.id)) { migrated.current.add(x.id); void saveTask(hid, uid, x, before); }
    });
  }, [hid, house, uid, tasks, storedTasks]);
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
      const out = makePlan({ now, horizonDays: 7, tasks, members, estimates, log, busy: busyBy, existing: existing.current, settings, swaps, awayUntil: away, presence: awayDocs, notToday: notToday.filter((n) => n.day >= today), declines });
      setComputed({ items: out.items, unplaced: out.unplaced });
      const sig = JSON.stringify(out.items.map((i) => [i.id, i.uid, i.start, i.end, i.pinned ? 1 : 0]));
      if (sig !== lastSaved.current && sig !== JSON.stringify(existing.current.map((i) => [i.id, i.uid, i.start, i.end, i.pinned ? 1 : 0]))) { lastSaved.current = sig; void savePlan(hid, uid, out.items); }
    }, 1200);
    return () => window.clearTimeout(handle);
  }, [hid, house, tasks, members, estimates, log, busy, settings, away, awayDocs, swaps, notToday, slot, uid]);

  const actions = useMemo<KajiActions | null>(() => {
    if (!hid) return null;
    return {
      logDone: async (taskId, minutes, r, o) => { await logEvent(hid, { taskId, uid, kind: 'done', at: Date.now(), minutes, planned: o?.planned ?? false, ...(o?.start !== undefined ? { start: o.start } : {}), ...(o?.custom ? { custom: o.custom.slice(0, 80) } : {}), ...(r.effort ? { effort: r.effort } : {}), ...(r.dislike ? { dislike: r.dislike } : {}), ...(r.enjoyment ? { enjoyment: r.enjoyment } : {}), ...(r.note?.trim() ? { note: r.note.trim().slice(0, 500) } : {}) });
        // a bundled chore done in the same go is logged as done by the same person, so its frequency and the balance stay right
        for (const w of o?.with ?? []) await logEvent(hid, { taskId: w.taskId, uid, kind: 'done', at: Date.now(), minutes: w.minutes, planned: true, ...(o?.start !== undefined ? { start: o.start } : {}) });
      },
      rate: async (id, r) => rateEvent(hid, id, r),
      undo: async () => {},
      notToday: async (item) => addNotToday(hid, uid, item.taskId, dayKey(item.start)),
      reschedule: async (item, start, reason, note, toUid) => {
        await logEvent(hid, { taskId: item.taskId, uid, kind: 'rescheduled', at: Date.now(), minutes: 0, planned: true, plannedStart: item.start, newStart: start, ...(reason ? { reason } : {}), ...(note ? { note: note.slice(0, 200) } : {}) });
        await savePlan(hid, uid, existing.current.map((x) => (x.id === item.id ? { ...x, ...(toUid ? { uid: toUid } : {}), start, end: start + (item.end - item.start), pinned: true } : x)));
      },
      dismiss: async (item, reason, note) => {
        await logEvent(hid, { taskId: item.taskId, uid, kind: 'dismissed', at: Date.now(), minutes: 0, planned: true, plannedStart: item.start, reason, ...(note ? { note: note.slice(0, 200) } : {}) });
        await savePlan(hid, uid, existing.current.filter((x) => x.id !== item.id));
      },
      move: async (item, to, start) => savePlan(hid, uid, existing.current.map((x) => (x.id === item.id ? { ...x, uid: to, start, end: start + (item.end - item.start), pinned: true } : x))),
      askSwap: async (item, to) => proposeSwap(hid, item, to),
      answerSwap: async (s, accept) => {
        await answerSwap(hid, s.id, accept ? 'accepted' : 'declined');
        // pinned on the item the swap is about, found by id or, when a re-plan changed the id, by chore and time; the planner applies it again on every re-plan
        if (accept) {
          const next = applySwaps(existing.current, [{ ...s, state: 'accepted' }], Date.now());
          if (next !== existing.current) await savePlan(hid, uid, next);
        }
      },
      saveTask: async (task, before) => saveTask(hid, uid, task, before),
      saveSettings: async (s) => saveSettings(hid, uid, s, settings),
      saveSurvey: async (a) => saveSurvey(hid, uid, a),
      setAway: async (until) => (until === null ? clearAway(hid, uid) : setAway(hid, uid, until)),
      setPresence: async (who, out) => setPresence(hid, who, out ? goOut(Date.now(), settings) : backHome(Date.now())),
      invite: async (email) => invite(hid, email, uid),
      ask: async (kind, text, when) => sendAsk(hid, { kind, text, when, by: uid, byName: membersOf(house).find((m) => m.uid === uid)?.name ?? '' }),
    };
  }, [hid, uid, settings, house]);

  const data = useMemo<KajiData | null>(() => (hid && house && members.length ? {
    hid, me: uid, house, members, tasks, log, survey, settings, away, presence: awayDocs, busy: busy?.events ?? {}, plan: computed.items, unplaced: computed.unplaced, swaps, estimates, now: slot * 5 * MIN,
  } : null), [hid, house, members, tasks, log, survey, settings, away, awayDocs, busy, computed, swaps, estimates, slot, uid]);
  return { hid, data, actions };
}

export function KajiModule({ uid, openId }: ModuleProps) {
  const { hid, data, actions } = useKaji(uid);
  const lang = initialLang();
  const joinHid = openId?.startsWith('join-') ? openId.slice(5) : null;
  const link = hid ? `${window.location.origin}${window.location.pathname}#/kaji/join-${hid}` : '';
  if (hid === undefined) return <main className="screen"><p className="empty">{t(lang, 'loading')}</p></main>;
  if (!hid || !data || !actions) {
    return (
      <main className="screen kaji">
        <header className="top"><div><span className="kicker">KAJI</span><h1>{t(lang, 'kajiSub')}</h1></div></header>
        <Setup lang={lang} defaultName="" joinHid={hid ? null : joinHid}
          onCreate={async (name, me) => { await createHousehold(uid, name, me, lang); }}
          onJoin={async (h, me) => { await join(uid, h, me, lang); window.location.hash = '#/kaji'; }} />
      </main>
    );
  }
  return <KajiView data={data} actions={actions} lang={lang} link={link} />;
}
