import { useState } from 'react';
import { signOutUser } from '../../auth';
import { Sky } from '../../sky/Sky';
import { useSky } from '../../sky/useSky';
import type { Ask } from './asks';
import { BalanceScreen } from './BalanceScreen';
import { ChoresScreen } from './ChoresScreen';
import { t } from './i18n';
import { initialLang, useKaji } from './index';
import type { LedgerEntry } from './ledger';
import { ListsScreen } from './ListsScreen';
import { MoneyScreen } from './MoneyScreen';
import type { Lang } from './model';
import { SettingsScreen } from './SettingsScreen';
import { Setup } from './Setup';
import { createHousehold, join } from './store';
import type { KList, KItem } from './store';
import { TodayScreen } from './TodayScreen';
import type { KajiActions, KajiData } from './ui';
import { WeekScreen } from './WeekScreen';

type Tab = 'today' | 'week' | 'lists' | 'money' | 'more';
const NAV: { id: Tab; d: string }[] = [
  { id: 'today', d: 'M4 4h16v16H4zM9 12l2 2 4-4' },
  { id: 'week', d: 'M4 6h16v14H4zM4 11h16M9 3v5M15 3v5' },
  { id: 'lists', d: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01' },
  { id: 'money', d: 'M12 3a9 9 0 100 18 9 9 0 000-18zM9 10c0-1.4 1.3-2 3-2s3 .6 3 2-1.3 1.7-3 2-3 .6-3 2 1.3 2 3 2 3-.6 3-2' },
  { id: 'more', d: 'M4 6h16M4 12h16M4 18h10' },
];
const LABEL: Record<Tab, string> = { today: 'today', week: 'week', lists: 'lists', money: 'money', more: 'more' };

function greeting(lang: Lang, name: string, now: number): string {
  const h = new Date(now + 9 * 3_600_000).getUTCHours();
  const g = lang === 'es' ? (h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches') : lang === 'ja' ? (h < 11 ? 'おはよう' : h < 18 ? 'こんにちは' : 'こんばんは') : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return lang === 'ja' ? `${g}、${name}` : `${g}, ${name}`;
}

/** The screens of the guest app, with no Firebase in them: the live app and the preview both feed this. */
export function GuestView({ data, actions, lang, onLang, link, tab: forced, onSignOut, previewLists, previewLedger, previewAsks }: {
  data: KajiData; actions: KajiActions; lang: Lang; onLang: (l: Lang) => void; link: string; tab?: Tab; onSignOut: () => void;
  previewLists?: { lists: KList[]; items: KItem[] }; previewLedger?: LedgerEntry[]; previewAsks?: Ask[];
}) {
  const [tab, setTab] = useState<Tab>(forced ?? 'today');
  const [more, setMore] = useState<'balance' | 'chores' | 'settings'>('balance');
  const me = data.members.find((m) => m.uid === data.me);
  const owner = data.members.find((m) => data.house.members[m.uid] === 'owner');
  const WD = { en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], ja: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'] }[lang];
  const d = new Date(data.now + 9 * 3_600_000);
  const dateLine = lang === 'ja' ? `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${WD[d.getUTCDay()]}` : `${WD[d.getUTCDay()]} ${d.getUTCDate()}`;
  return (
    <>
      <main className="screen kaji guest">
        <header className="top"><div><span className="kicker">{data.house.name.toUpperCase()} · {dateLine}</span><h1>{greeting(lang, me?.name ?? '', data.now)}</h1></div></header>
        {tab === 'today' ? <TodayScreen data={data} actions={actions} lang={lang} {...(previewAsks ? { askPreview: previewAsks } : {})} /> : null}
        {tab === 'week' ? <WeekScreen data={data} lang={lang} actions={actions} /> : null}
        {tab === 'lists' ? <ListsScreen data={data} lang={lang} {...(previewLists ? { preview: previewLists } : {})} /> : null}
        {tab === 'money' ? <MoneyScreen data={data} lang={lang} {...(previewLedger ? { preview: previewLedger } : {})} /> : null}
        {tab === 'more' ? (
          <>
            <div className="seg kaji-tabs" role="tablist">
              {(['balance', 'chores', 'settings'] as const).map((k) => <button key={k} role="tab" aria-pressed={more === k} onClick={() => setMore(k)} style={{ textTransform: 'none' }}>{t(lang, k === 'settings' ? 'settings' : k)}</button>)}
            </div>
            {more === 'balance' ? <BalanceScreen data={data} lang={lang} /> : null}
            {more === 'chores' ? <ChoresScreen data={data} actions={actions} lang={lang} /> : null}
            {more === 'settings' ? <SettingsScreen data={data} actions={actions} lang={lang} onLang={onLang} link={link} /> : null}
            <div className="panel settings" style={{ marginTop: 14 }}>
              <div className="setting"><span>{me?.name}{owner ? ` · ${owner.name}` : ''}</span><button className="chip-btn" onClick={onSignOut}>{lang === 'es' ? 'Salir' : lang === 'ja' ? 'ログアウト' : 'Sign out'}</button></div>
            </div>
          </>
        ) : null}
      </main>
      <nav className="tabs tabs-5" aria-label="Sections">
        {NAV.map((n) => (
          <a key={n.id} href={`#/g/${n.id}`} aria-current={tab === n.id ? 'page' : undefined} onClick={(e) => { e.preventDefault(); setTab(n.id); window.scrollTo(0, 0); }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={n.d} /></svg>
            {t(lang, LABEL[n.id])}
          </a>
        ))}
      </nav>
    </>
  );
}

/** The whole app for a person who belongs to a household and nothing else: no cards, drafts, trips or sleep, just the house. */
export function GuestApp({ uid }: { uid: string }) {
  const { hid, data, actions } = useKaji(uid);
  const [lang, setLang] = useState<Lang>(() => initialLang());
  const changeLang = (l: Lang) => { setLang(l); try { window.localStorage.setItem('kaji.lang', l); } catch { /* private mode */ } };
  const sky = useSky([], undefined, true);
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const joinHid = window.location.hash.startsWith('#/kaji/join-') ? window.location.hash.slice('#/kaji/join-'.length) : null;
  const link = hid ? `${window.location.origin}${window.location.pathname}#/kaji/join-${hid}` : '';
  if (hid === undefined) return <main className="screen"><p className="empty">{t(lang, 'loading')}</p></main>;
  if (!hid || !data || !actions) {
    return (
      <main className="screen kaji">
        <header className="top"><div><span className="kicker">KAJI</span><h1>{t(lang, 'kajiSub')}</h1></div></header>
        <Setup lang={lang} onLang={changeLang} defaultName="" joinHid={hid ? null : joinHid}
          onCreate={async (name, me) => { await createHousehold(uid, name, me, lang); }}
          onJoin={async (h, me) => { await join(uid, h, me, lang); window.location.hash = '#/'; }} />
      </main>
    );
  }
  return (
    <>
      {sky ? <Sky state={sky} dark={dark} mode="subtle" /> : null}
      <GuestView data={data} actions={actions} lang={lang} onLang={changeLang} link={link} onSignOut={() => { void signOutUser(); }} />
    </>
  );
}
