import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { AddSheet } from './AddSheet';
import { completeRedirectSignIn, describeAuthError, signInWithGoogle, watchAuthState } from './auth';
import { addAlloc, addCard, joinCards, cyclePriority, addItem, tickBring, tickItem, addMarketItem, addReceipt, logPurchase, addEntry, addMemo, addResource, archiveResource, answerDraft, answerRelay, closeRelay, editAlloc, editDraft, repeatAlloc, reviseDraft, seedAllocMonth, toggleAlloc, callNexo, discardDraft, markCopied, markDone, markLater, markSent, requestMailCheck, requestSend, setSleep, watchDrafts, watchEntries, watchFiles, watchNexo, watchClosedRelays, watchDoneCards, watchAllocations, watchMarket, watchMemos, watchReceipts, watchOpenCards, watchRelays, watchResources, watchSync, watchTodayInfo } from './cards';
import { isFirebaseConfigured } from './firebase';
import { Money } from './Money';
import { nexoSection } from './nexo';
import { Notes } from './Notes';
import { Search } from './Search';
import { Shelf } from './Shelf';
import { applySettings, loadSettings, saveSettings, type Settings } from './settings';
import { TabBar } from './TabBar';
import { Browse } from './Browse';
import { bandOf } from './urgency';
import { Drafts } from './Drafts';
import { Thread } from './Thread';
import { ToastHost } from './Toast';
import { UpdateBar } from './UpdateBar';
import { flash } from './toast';
import { Trips } from './Trips';
import { Upcoming } from './Upcoming';
import { Today } from './Today';
import type { Alloc, Market, Receipt, Card, CardFile, Draft, Entry, Memo, NexoStatus, Relay, Resource, TodayInfo } from './types';
import { useRoute } from './useHash';

function SignIn({ error, onSignIn }: { error: string; onSignIn: () => void }) {
  return (
    <main className="screen center signin">
      <div className="mark" aria-hidden="true"><i /></div>
      <h1>One queue for what needs you.</h1>
      <p className="lede">Your tasks, drafts and assistant in one place. Works offline.</p>
      <button className="send-wide" onClick={onSignIn}>Continue with Google</button>
      {error ? <p className="notice">{error}</p> : null}
    </main>
  );
}

function ThreadView({ uid, card, drafts, others, onDone, onLater }: { uid: string; card: Card; drafts: Draft[]; others: Card[]; onDone: () => void; onLater: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  useEffect(() => watchEntries(uid, card.id, setEntries, (e) => console.warn('[entries]', e)), [uid, card.id]);
  const [pics, setPics] = useState<CardFile[]>([]);
  useEffect(() => watchFiles(uid, card.id, setPics, (e) => console.warn('[files]', e)), [uid, card.id]);
  return (
    <Thread card={card} entries={entries} pics={pics} drafts={drafts} now={new Date()}
      onBack={() => { window.location.hash = '#/'; }}
      onReply={(t) => { void addEntry(uid, card, t); flash('Reply sent to Nexo'); }} onDone={onDone} onLater={onLater}
      onPriority={() => { void cyclePriority(uid, card); }} onBring={(i, g) => { void tickBring(uid, card, i, g); }} onItem={(id, d) => { void tickItem(uid, card, id, d); }} onAddItem={(t) => { void addItem(uid, card, t); }}
      others={others} onJoin={(cs) => { void joinCards(uid, cs).then(() => { flash('Joined into one card'); window.location.hash = '#/'; }); }} />
  );
}

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [cards, setCards] = useState<Card[]>([]);
  const [fromCache, setFromCache] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [nexo, setNexo] = useState<NexoStatus | null | undefined>(undefined);
  const [relays, setRelays] = useState<Relay[]>([]);
  const [info, setInfo] = useState<TodayInfo | null>(null);
  const [doneCards, setDoneCards] = useState<Card[]>([]);
  const [closedRelays, setClosedRelays] = useState<Relay[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [allocs, setAllocs] = useState<Alloc[]>([]);
  const [market, setMarket] = useState<Market | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [syncAt, setSyncAt] = useState<number | null | undefined>(undefined);
  const [clock, setClock] = useState(() => Date.now());
  const route = useRoute();
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const changeSettings = (next: Settings) => { setSettings(next); saveSettings(next); applySettings(next); };

  useEffect(() => {
    applySettings(settings);
    if (!window.location.hash && settings.start === 'upcoming') window.location.hash = '#/upcoming';
    // Run once at launch: later changes to the setting must not move him off the screen he is on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void completeRedirectSignIn();
    return watchAuthState(setUser);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    return watchOpenCards(user.uid, (c, cache) => { setCards(c); setFromCache(cache); }, (e) => setError(e.message));
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    return watchDrafts(user.uid, setDrafts, (e) => setError(e.message));
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    return watchRelays(user.uid, setRelays, (e) => setError(e.message));
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    return watchTodayInfo(user.uid, setInfo);
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    const stop = watchSync(user.uid, setSyncAt);
    const stopNexo = watchNexo(user.uid, setNexo);
    const tick = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => { stop(); stopNexo(); window.clearInterval(tick); };
  }, [user]);

  const onMoney = route.name === 'money';
  useEffect(() => {
    if (!user || !onMoney) return undefined;
    const stops = [watchAllocations(user.uid, setAllocs, (e) => console.warn('[money]', e)), watchMarket(user.uid, setMarket), watchReceipts(user.uid, setReceipts, (e) => console.warn('[money]', e))];
    return () => stops.forEach((x) => x());
  }, [user, onMoney]);

  const onNotes = route.name === 'notes';
  useEffect(() => {
    if (!user || !onNotes) return undefined;
    return watchMemos(user.uid, setMemos, (e) => console.warn('[notes]', e));
  }, [user, onNotes]);

  const onShelf = route.name === 'shelf';
  useEffect(() => {
    if (!user || !onShelf) return undefined;
    const warn = (e: Error) => console.warn('[shelf]', e);
    const stops = [watchDoneCards(user.uid, setDoneCards, warn), watchClosedRelays(user.uid, setClosedRelays, warn), watchResources(user.uid, setResources, warn)];
    return () => stops.forEach((s) => s());
  }, [user, onShelf]);

  if (!isFirebaseConfigured) return <main className="screen center"><p className="notice">Firebase is not configured. Fill in .env.local.</p></main>;
  if (user === undefined) return <main className="screen center"><p className="notice">Loading</p></main>;
  if (user === null) {
    return <SignIn error={error} onSignIn={() => { signInWithGoogle().catch((e: unknown) => setError(describeAuthError(e))); }} />;
  }
  const done = (c: Card) => { void markDone(user.uid, c.id); flash('Marked done'); };
  const later = (c: Card) => { void markLater(user.uid, c); flash('Moved one day on'); };
  const card = route.name === 'card' ? cards.find((c) => c.id === route.id) : undefined;

  if (route.name === 'card') {
    return card ? (
      <ThreadView uid={user.uid} card={card} drafts={drafts} others={cards.filter((c) => c.id !== card.id && c.status === 'open')}
        onDone={() => { done(card); window.location.hash = '#/'; }} onLater={() => { later(card); window.location.hash = '#/'; }} />
    ) : (
      <main className="screen center"><p className="notice">{fromCache ? 'Loading' : 'That card is closed or not found.'}</p><a className="chip-btn link" href="#/">Back</a></main>
    );
  }

  const tab = route.name;
  // The sync service writes a heartbeat every minute. Five minutes without one means changes made here
  // are saved but not reaching Nexo, and the screen should say so rather than look healthy.
  const syncLate = syncAt !== undefined && (syncAt === null || clock - syncAt > 5 * 60_000);
  return (
    <>
      <ToastHost />
      <UpdateBar />
      {syncLate ? <p className="sync-warn" role="status">Sync is behind, or you are offline. Changes are saved here and reach Nexo when it catches up.</p> : null}
      {tab === 'money' ? (
        <Money allocations={allocs} onAdd={(a) => { void addAlloc(user.uid, a); }} onToggle={(a) => { void toggleAlloc(user.uid, a); }}
          onEdit={(a, c) => { void editAlloc(user.uid, a, c); }} onRepeat={(a) => { void repeatAlloc(user.uid, a); }} onSeed={(m) => { void seedAllocMonth(user.uid, m); }}
          market={market} receipts={receipts} onLog={(i) => { void logPurchase(user.uid, i); }} onAddItem={(n) => { void addMarketItem(user.uid, n); }} onReceipt={(r) => { void addReceipt(user.uid, r); }} />
      ) : tab === 'notes' ? (
        <Notes memos={memos} onKeep={(t, g) => { void addMemo(user.uid, t, g); }} />
      ) : tab === 'trips' ? (
        <Trips cards={cards} now={new Date()} />
      ) : tab === 'shelf' ? (
        <Shelf done={doneCards} closed={closedRelays} resources={resources}
          onAdd={(r) => { void addResource(user.uid, r); }} onArchive={(r, a) => { void archiveResource(user.uid, r, a); }} />
      ) : tab === 'search' ? (
        <Search cards={cards} now={new Date()} />
      ) : tab === 'upcoming' ? (
        <Upcoming cards={cards} now={new Date()} onDone={done} />
      ) : tab === 'browse' ? (
        <Browse nexoCount={cards.filter((c) => c.for === 'nexo').length} draftCount={drafts.length} settings={settings} onSettings={changeSettings}
          onSleep={(until) => { void setSleep(user.uid, until); }} />
      ) : tab === 'drafts' ? (
        <Drafts drafts={drafts}
          onCopied={(id) => { void markCopied(user.uid, id); flash('Copied'); }}
          onSent={(id) => { void markSent(user.uid, id); }}
          onDiscard={(id) => { void discardDraft(user.uid, id); }}
          nexo={nexo} onMailCheck={() => { void requestMailCheck(user.uid); }}
          onSend={(d) => { void requestSend(user.uid, d); flash('Send requested. Nexo sends it on its next run.'); }}
          onEdit={(d, t) => { void editDraft(user.uid, d, t); }}
          onRevise={(d, t) => { void reviseDraft(user.uid, d, t); }}
          onAnswer={(d, t) => { void answerDraft(user.uid, d, t); }} />
      ) : (
        <Today cards={cards} now={new Date()} fromCache={fromCache} lane={tab === 'nexo' ? 'nexo' : 'you'}
          withDraft={new Set(drafts.filter((d) => d.status !== 'sent').map((d) => d.linkedNote ?? ''))}
          waiting={cards.filter((c) => c.last?.by === 'eduardo').length} nexo={nexo} info={info}
          relays={relays} onAnswerRelay={(r, t) => { void answerRelay(user.uid, r, t); }} onCloseRelay={(r) => { void closeRelay(user.uid, r); }}
          onDone={done} onLater={later} onCallNexo={() => { void callNexo(user.uid); flash('Nexo called'); }} onWake={() => { void setSleep(user.uid, null); }} />
      )}
      {tab === 'today' ? (
        <button className="fab" aria-label="Add a task" onClick={() => setAdding(true)}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      ) : null}
      <TabBar todayCount={cards.filter((c) => c.for === 'you' && ['urgent', 'overdue'].includes(bandOf(c, new Date()))).length + relays.length}
        browseCount={cards.filter((c) => c.for === 'nexo' && ['nexo', 'close'].includes(nexoSection(c, new Date()))).length} current={tab === 'nexo' || tab === 'search' || tab === 'shelf' || tab === 'trips' || tab === 'notes' || tab === 'money' ? 'browse' : tab} draftCount={drafts.filter((d) => d.status !== 'sent').length} />
      {adding ? <AddSheet onClose={() => setAdding(false)} onAdd={(t, w, due, pr) => { void addCard(user.uid, t, w, due, pr); }} /> : null}
    </>
  );
}
