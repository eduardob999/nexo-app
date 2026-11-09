import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { AddSheet } from './AddSheet';
import type { WakeDoc } from './alarm';
import type { SleepRec } from './sleepmodel';
import { SleepScreen } from './SleepScreen';
import { makeThumb, uploadToDrive } from './drive';
import { completeRedirectSignIn, describeAuthError, signInWithGoogle, watchAuthState } from './auth';
import { newCardId, reopenCard, watchCard, joinCards, clearDoneCards, deleteCard, deleteMemo, deleteReceipt, removeItem, undoPurchase, addAlloc, addCard, attachFile, cyclePriority, setIncoming, addItem, tickBring, tickItem, addMarketItem, addReceipt, logPurchase, addEntry, addMemo, addResource, archiveResource, answerDraft, attachToDraft, detachFromDraft, answerRelay, closeRelay, editAlloc, editDraft, repeatAlloc, reviseDraft, seedAllocMonth, toggleAlloc, callNexo, cardContext, discardDraft, markCopied, markDone, markLater, markSent, requestMailCheck, requestSend, setSleep, answerWake, recordWake, watchWake, watchSleep, goToBed, undoBed, imUp, rateSleep, editSleep, writeSleepPlan, watchDrafts, watchRest, markRestDay, undoRestDay, rateRest, watchEntries, watchFiles, watchNexo, watchClosedRelays, watchDoneCards, watchRecentDoneCards, watchDoneTrips, watchAllocations, watchChat, sendChat, watchMarket, watchMemos, watchReceipts, watchReceiptFiles, watchOpenCards, watchRelays, watchAnsweredRelays, watchResources, watchSync, watchTodayInfo } from './cards';
import { doneCutoff } from './shelf';
import type { RestRec } from './restmodel';
import { isFirebaseConfigured, reconnect } from './firebase';
import { Money } from './Money';
import { nexoSection } from './nexo';
import { Notes } from './Notes';
import { Search } from './Search';
import { Shelf } from './Shelf';
import { FudeModule, FudeCardWidget, openForCard, openForDraft } from './modules/fude';
import { applySettings, loadSettings, saveSettings, type Settings } from './settings';
import { TabBar } from './TabBar';
import { Browse } from './Browse';
import { bandOf } from './urgency';
import { Drafts } from './Drafts';
import { Thread } from './Thread';
import { Chat } from './Chat';
import type { ChatMsg } from './chatlogic';
import { ToastHost } from './Toast';
import { UpdateBar } from './UpdateBar';
import { flash } from './toast';
import { uploadFailText } from './addfiles';
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

/** A card that is not among the open ones: read it directly, so a finished card's thread opens and can be reopened. */
function ClosedThread({ uid, id, drafts, fromCache }: { uid: string; id: string; drafts: Draft[]; fromCache: boolean }) {
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  useEffect(() => watchCard(uid, id, setCard), [uid, id]);
  if (card) return <ThreadView uid={uid} card={card} drafts={drafts} />;
  return <main className="screen center"><p className="notice">{card === undefined || fromCache ? 'Loading' : 'That card is closed or not found.'}</p><a className="chip-btn link" href="#/">Back</a></main>;
}

function ThreadView({ uid, card, drafts }: { uid: string; card: Card; drafts: Draft[] }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  useEffect(() => watchEntries(uid, card.id, setEntries, (e) => console.warn('[entries]', e)), [uid, card.id]);
  const [pics, setPics] = useState<CardFile[]>([]);
  useEffect(() => watchFiles(uid, card.id, setPics, (e) => console.warn('[files]', e)), [uid, card.id]);
  return (
    <Thread card={card} entries={entries} pics={pics} drafts={drafts} now={new Date()}
      widget={(card.type ?? '').toUpperCase() === 'ASSIGNMENT' ? <FudeCardWidget uid={uid} card={{ ...card, entries, files: pics.length ? pics : card.files }} /> : null}
      onBack={() => { window.location.hash = '#/'; }}
      onReply={(t) => { void addEntry(uid, card, t); flash('Reply sent to Nexo'); }}
      onPriority={() => { void cyclePriority(uid, card); }} onIncoming={(v) => { void setIncoming(uid, card, v); }} onBring={(i, g) => { void tickBring(uid, card, i, g); }} onItem={(id, d) => { void tickItem(uid, card, id, d); }} onAddItem={(t) => { void addItem(uid, card, t); }} onRemoveItem={(id) => { void removeItem(uid, card, id); }}
      onReopen={() => { void reopenCard(uid, card.id); flash('Reopened'); }}
      onDelete={() => { void deleteCard(uid, card.id); window.location.hash = '#/'; flash('Card deleted'); }}
      onAttach={async (files) => { const done: { name: string; url: string }[] = []; for (const f of files) { const thumb = await makeThumb(f); const up = await uploadToDrive(f); await attachFile(uid, { cardId: card.id }, up, thumb); done.push({ name: up.name, url: up.viewUrl }); } flash('Attached'); return done; }} />
  );
}

/** Upload the files chosen in the Add sheet onto the card just made. Runs after the sheet has closed. */
async function uploadNewCardFiles(uid: string, cardId: string, files: File[]): Promise<void> {
  if (files.length === 0) return;
  try {
    for (const f of files) { const thumb = await makeThumb(f); const up = await uploadToDrive(f); await attachFile(uid, { cardId }, up, thumb); }
    flash(files.length > 1 ? 'Card added with photos' : 'Card added with photo');
  } catch (e) { flash(uploadFailText(e), 'warn'); }
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
  const [answeredRelays, setAnsweredRelays] = useState<Relay[]>([]);
  const [info, setInfo] = useState<TodayInfo | null>(null);
  const [wake, setWake] = useState<WakeDoc | null>(null);
  const [sleep, setSleepRecs] = useState<SleepRec[]>([]);
  const [rest, setRest] = useState<RestRec[]>([]);
  const [doneCards, setDoneCards] = useState<Card[]>([]);
  const [showOlderDone, setShowOlderDone] = useState(false);
  const [closedRelays, setClosedRelays] = useState<Relay[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [allocs, setAllocs] = useState<Alloc[]>([]);
  const [market, setMarket] = useState<Market | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [syncAt, setSyncAt] = useState<number | null | undefined>(undefined);
  /** True while the heartbeat shown is the copy saved on the phone; `since` is when the app started waiting. */
  const [syncCache, setSyncCache] = useState<{ cache: boolean; since: number }>({ cache: true, since: Date.now() });
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
    return watchAnsweredRelays(user.uid, setAnsweredRelays, (e) => console.warn('[relays]', e));
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    return watchTodayInfo(user.uid, setInfo);
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    return watchWake(user.uid, setWake);
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    return watchSleep(user.uid, setSleepRecs, (e) => console.warn('[sleep]', e));
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    return watchRest(user.uid, setRest, (e) => console.warn('[rest]', e));
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    const cacheRef = { cache: true, since: Date.now() };
    const stop = watchSync(user.uid, (ms, cache) => {
      setSyncAt(ms);
      if (cache !== cacheRef.cache) cacheRef.since = Date.now();
      cacheRef.cache = cache;
      setSyncCache({ cache, since: cacheRef.since });
    });
    const stopNexo = watchNexo(user.uid, setNexo);
    const tick = window.setInterval(() => setClock(Date.now()), 5_000);
    // Coming back to the app, or the network returning, can leave the live listener on the saved copy.
    // If the server has not answered within a few seconds, reopen the connection instead of waiting for a reload.
    let kick: number | undefined;
    const wake = () => {
      if (document.visibilityState === 'hidden') return;
      cacheRef.cache = true;
      cacheRef.since = Date.now();
      setSyncCache({ cache: true, since: cacheRef.since });
      window.clearTimeout(kick);
      kick = window.setTimeout(() => { if (cacheRef.cache) void reconnect().catch(() => {}); }, 6_000);
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    wake();
    return () => { stop(); stopNexo(); window.clearInterval(tick); window.clearTimeout(kick); document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake); };
  }, [user]);

  const onChat = route.name === 'chat';
  const [chat, setChat] = useState<ChatMsg[]>([]);
  useEffect(() => {
    if (!user || !onChat) return undefined;
    return watchChat(user.uid, setChat, (e) => console.warn('[chat]', e));
  }, [user, onChat]);

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
  const onTrips = route.name === 'trips';
  useEffect(() => {
    if (!user || !onTrips) return undefined;
    return watchDoneTrips(user.uid, setDoneCards, (e) => console.warn('[trips]', e));
  }, [user, onTrips]);
  useEffect(() => {
    if (!user || !onShelf) return undefined;
    const warn = (e: Error) => console.warn('[shelf]', e);
    // The last month by default; "Show older" asks for everything, once, and only when he taps it.
    const stops = [showOlderDone ? watchDoneCards(user.uid, setDoneCards, warn) : watchRecentDoneCards(user.uid, doneCutoff(new Date(), 30), setDoneCards, warn), watchClosedRelays(user.uid, setClosedRelays, warn), watchResources(user.uid, setResources, warn)];
    return () => stops.forEach((s) => s());
  }, [user, onShelf, showOlderDone]);

  if (!isFirebaseConfigured) return <main className="screen center"><p className="notice">Firebase is not configured. Fill in .env.local.</p></main>;
  if (user === undefined) return <main className="screen center"><p className="notice">Loading</p></main>;
  if (user === null) {
    return <SignIn error={error} onSignIn={() => { signInWithGoogle().catch((e: unknown) => setError(describeAuthError(e))); }} />;
  }
  const done = (c: Card) => { void markDone(user.uid, c.id); flash('Marked done'); };
  const later = (c: Card) => { void markLater(user.uid, c); flash('Moved one day on'); };
  const card = route.name === 'card' ? cards.find((c) => c.id === route.id) : undefined;

  if (route.name === 'chat') {
    return <Chat msgs={chat} onBack={() => { window.location.hash = '#/'; }} onSend={(t) => { void sendChat(user.uid, t); }} />;
  }

  if (route.name === 'card') {
    return card ? <ThreadView uid={user.uid} card={card} drafts={drafts} /> : <ClosedThread uid={user.uid} id={route.id} drafts={drafts} fromCache={fromCache} />;
  }

  const tab = route.name;
  // The sync service writes a heartbeat every minute. Five minutes without one means changes made here
  // are saved but not reaching Nexo, and the screen should say so rather than look healthy.
  // A heartbeat that is only the saved copy is not evidence the sync stopped: give the server 20 seconds to answer
  // before saying anything, and then say so, since a phone that cannot reach the server really is behind.
  const syncLate = syncAt !== undefined && (syncCache.cache
    ? clock - syncCache.since > 20_000
    : syncAt === null || clock - syncAt > 5 * 60_000);
  return (
    <>
      <ToastHost />
      <UpdateBar />
      {syncLate ? <p className="sync-warn" role="status">Sync is behind, or you are offline. Changes are saved here and reach Nexo when it catches up.</p> : null}
      {tab === 'money' ? (
        <Money allocations={allocs} onAdd={(a) => { void addAlloc(user.uid, a); }} onToggle={(a) => { void toggleAlloc(user.uid, a); }}
          onEdit={(a, c) => { void editAlloc(user.uid, a, c); }} onRepeat={(a) => { void repeatAlloc(user.uid, a); }} onSeed={(m) => { void seedAllocMonth(user.uid, m); }}
          market={market} receipts={receipts} onLog={(i) => { void logPurchase(user.uid, i); }} onAddItem={(n) => { void addMarketItem(user.uid, n); }} onReceipt={(r) => { void addReceipt(user.uid, r); }}
          onUndo={(id) => { if (market) void undoPurchase(user.uid, market, id); }} onDeleteReceipt={(r) => { void deleteReceipt(user.uid, r.id); flash('Receipt deleted'); }}
          watchPhotos={(id, on) => watchReceiptFiles(user.uid, id, on)}
          onAttachReceipt={async (r, files) => { for (const f of files) { const thumb = await makeThumb(f); const up = await uploadToDrive(f); await attachFile(user.uid, { receiptId: r.id }, up, thumb); } flash('Photo attached'); }} />
      ) : tab === 'notes' ? (
        <Notes memos={memos} onKeep={(t, g) => { void addMemo(user.uid, t, g); }} onDelete={(m) => { void deleteMemo(user.uid, m.id); flash('Note deleted'); }} />
      ) : tab === 'sleep' ? (
        <SleepScreen recs={sleep} cards={cards} now={new Date()} wake={wake} rest={rest}
          restActions={{
            onMark: (d, k) => { void markRestDay(user.uid, d, k); flash(k === 'full' ? 'Full rest day. Enjoy it.' : 'Light rest day noted'); },
            onUndo: (d) => { void undoRestDay(user.uid, d); flash('Rest day removed'); },
            onRate: (d, p) => { void rateRest(user.uid, d, p); flash('Rest saved'); },
          }} />
      ) : tab === 'homework' ? (
        <FudeModule uid={user.uid} openId={route.name === 'homework' ? route.id : undefined} host={{ sendBackDraft: (draftId, text) => { const d = drafts.find((x) => x.id === draftId); if (d) { void editDraft(user.uid, d, text); flash('Text sent back to the draft'); window.location.hash = '#/drafts'; } } }} />
      ) : tab === 'trips' ? (
        <Trips cards={cards} now={new Date()} done={doneCards} />
      ) : tab === 'shelf' ? (
        <Shelf done={doneCards} closed={closedRelays} resources={resources} onShowOlder={showOlderDone ? undefined : () => setShowOlderDone(true)}
          onAdd={(r) => { void addResource(user.uid, r); }} onArchive={(r, a) => { void archiveResource(user.uid, r, a); }}
          onReopen={(c) => { void reopenCard(user.uid, c.id); flash('Reopened'); }}
          onClearDone={(ids) => { void clearDoneCards(user.uid, ids); flash(`Cleared ${ids.length} done cards`); }} />
      ) : tab === 'search' ? (
        <Search cards={cards} now={new Date()} />
      ) : tab === 'upcoming' ? (
        <Upcoming cards={cards} now={new Date()} onDone={done} />
      ) : tab === 'browse' ? (
        <Browse uid={user.uid} nexoCount={cards.filter((c) => c.for === 'nexo').length} draftCount={drafts.filter((d) => d.status !== 'sent').length} settings={settings} onSettings={changeSettings}
          onSleep={(until) => { void setSleep(user.uid, until); }} />
      ) : tab === 'drafts' ? (
        <Drafts drafts={drafts} cards={cards} onFude={(d) => { void openForDraft(user.uid, d); }}
          watchPics={(id, on) => watchFiles(user.uid, id, on, (e) => console.warn('[files]', e))}
          onAttachExisting={(d, f) => { if (f.driveId) void attachToDraft(user.uid, d, { id: f.id, name: f.name ?? 'file', ...(f.type ? { type: f.type } : {}), driveId: f.driveId, ...(f.viewUrl ? { viewUrl: f.viewUrl } : {}) }); }}
          onDetach={(d, id) => { void detachFromDraft(user.uid, d, id); }}
          onUpload={async (d, files) => { for (const f of files) { const thumb = await makeThumb(f); const up = await uploadToDrive(f); if (d.linkedNote) await attachFile(user.uid, { cardId: d.linkedNote }, up, thumb); await attachToDraft(user.uid, d, up); } flash('Attached to draft'); }}
          onCopied={(id) => { void markCopied(user.uid, id); flash('Copied'); }}
          onSent={(id) => { void markSent(user.uid, id); }}
          onDiscard={(id) => { void discardDraft(user.uid, id); }}
          nexo={nexo} onMailCheck={() => { void requestMailCheck(user.uid); }}
          onSend={(d) => { void requestSend(user.uid, d); flash('Send requested. Nexo sends it on its next run.'); }}
          onEdit={(d, t) => { void editDraft(user.uid, d, t); }}
          onRevise={(d, t) => { void reviseDraft(user.uid, d, t); }}
          onAnswer={(d, t) => { void answerDraft(user.uid, d, t); }} />
      ) : (
        <Today cards={cards} now={new Date()} fromCache={fromCache} onFude={(c) => { void cardContext(user.uid, c).then((full) => openForCard(user.uid, full)); }} lane={tab === 'nexo' ? 'nexo' : 'you'}
          withDraft={new Set(drafts.filter((d) => d.status !== 'sent').map((d) => d.linkedNote ?? ''))}
          waiting={cards.filter((c) => c.last?.by === 'eduardo').length} nexo={nexo} info={info} wake={wake} sleep={sleep}
          rest={rest} onRateRest={(d, p) => { void rateRest(user.uid, d, p); flash('Rest saved'); }}
          sleepActions={{
            onGoToBed: () => { void goToBed(user.uid, new Date()).then(() => flash('Good night')); },
            onUndoBed: (n) => { void undoBed(user.uid, n); flash('Bedtime removed'); },
            onImUp: (n) => { void imUp(user.uid, n, new Date()); },
            onRate: (n, r, f, t) => { void rateSleep(user.uid, n, r, f, t); flash('Sleep saved'); },
            onEditTimes: (n, t) => { void editSleep(user.uid, n, t); },
            onPlan: (p) => { void writeSleepPlan(user.uid, p); },
          }}
          onRecordWake={(d, r) => { void recordWake(user.uid, d, r); }} onAnswerWake={(d, r, f, p) => { void answerWake(user.uid, d, r, f, p); flash('Thanks, noted'); }}
          relays={relays} answeredRelays={answeredRelays} onAnswerRelay={(r, t) => { void answerRelay(user.uid, r, t); }} onCloseRelay={(r) => { void closeRelay(user.uid, r); }}
          onDone={done} onLater={later} onJoin={(cs) => { void joinCards(user.uid, cs).then(() => flash(`Joined ${cs.length} cards`)); }} onCallNexo={(mail) => { void callNexo(user.uid); if (mail) void requestMailCheck(user.uid); flash(mail ? 'Nexo called, mail check included' : 'Nexo called'); }} onWake={() => { void setSleep(user.uid, null); }} />
      )}
      {tab === 'today' ? (
        <button className="fab" aria-label="Add a task" onClick={() => setAdding(true)}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      ) : null}
      <TabBar todayCount={cards.filter((c) => c.for === 'you' && ['urgent', 'overdue'].includes(bandOf(c, new Date()))).length + relays.length}
        browseCount={cards.filter((c) => c.for === 'nexo' && ['nexo', 'close'].includes(nexoSection(c, new Date()))).length + answeredRelays.length} current={tab === 'nexo' || tab === 'search' || tab === 'shelf' || tab === 'trips' || tab === 'notes' || tab === 'money' || tab === 'sleep' || tab === 'homework' ? 'browse' : tab} draftCount={drafts.filter((d) => d.status !== 'sent').length} />
      {adding ? <AddSheet onClose={() => setAdding(false)} onAdd={(t, w, due, pr, files, lines) => { const id = newCardId(); void addCard(user.uid, t, w, due, pr, id, lines).then(() => uploadNewCardFiles(user.uid, id, files)); }} /> : null}
    </>
  );
}
