import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { AddSheet } from './AddSheet';
import { completeRedirectSignIn, describeAuthError, signInWithGoogle, watchAuthState } from './auth';
import { addCard, addEntry, callNexo, discardDraft, markCopied, markDone, markLater, markSent, watchDrafts, watchEntries, watchOpenCards } from './cards';
import { isFirebaseConfigured } from './firebase';
import { TabBar } from './TabBar';
import { Browse } from './Browse';
import { Drafts } from './Drafts';
import { Thread } from './Thread';
import { Upcoming } from './Upcoming';
import { Today } from './Today';
import type { Card, Draft, Entry } from './types';
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

function ThreadView({ uid, card, drafts, onDone, onLater }: { uid: string; card: Card; drafts: Draft[]; onDone: () => void; onLater: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  useEffect(() => watchEntries(uid, card.id, setEntries, (e) => console.warn('[entries]', e)), [uid, card.id]);
  return (
    <Thread card={card} entries={entries} drafts={drafts} now={new Date()}
      onBack={() => { window.location.hash = '#/'; }}
      onReply={(t) => { void addEntry(uid, card.id, t); }} onDone={onDone} onLater={onLater} />
  );
}

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [cards, setCards] = useState<Card[]>([]);
  const [fromCache, setFromCache] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const route = useRoute();

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

  if (!isFirebaseConfigured) return <main className="screen center"><p className="notice">Firebase is not configured. Fill in .env.local.</p></main>;
  if (user === undefined) return <main className="screen center"><p className="notice">Loading</p></main>;
  if (user === null) {
    return <SignIn error={error} onSignIn={() => { signInWithGoogle().catch((e: unknown) => setError(describeAuthError(e))); }} />;
  }
  const done = (c: Card) => { void markDone(user.uid, c.id); };
  const later = (c: Card) => { void markLater(user.uid, c); };
  const card = route.name === 'card' ? cards.find((c) => c.id === route.id) : undefined;

  if (route.name === 'card') {
    return card ? (
      <ThreadView uid={user.uid} card={card} drafts={drafts}
        onDone={() => { done(card); window.location.hash = '#/'; }} onLater={() => { later(card); window.location.hash = '#/'; }} />
    ) : (
      <main className="screen center"><p className="notice">{fromCache ? 'Loading' : 'That card is closed or not found.'}</p><a className="chip-btn link" href="#/">Back</a></main>
    );
  }

  const tab = route.name;
  return (
    <>
      {tab === 'upcoming' ? (
        <Upcoming cards={cards} now={new Date()} onDone={done} />
      ) : tab === 'browse' ? (
        <Browse nexoCount={cards.filter((c) => c.for === 'nexo').length} draftCount={drafts.length} />
      ) : tab === 'drafts' ? (
        <Drafts drafts={drafts}
          onCopied={(id) => { void markCopied(user.uid, id); }}
          onSent={(id) => { void markSent(user.uid, id); }}
          onDiscard={(id) => { void discardDraft(user.uid, id); }} />
      ) : (
        <Today cards={cards} now={new Date()} fromCache={fromCache} lane={tab === 'nexo' ? 'nexo' : 'you'}
          onDone={done} onLater={later} onCallNexo={() => { void callNexo(user.uid); }} />
      )}
      {tab === 'today' ? (
        <button className="fab" aria-label="Add a task" onClick={() => setAdding(true)}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      ) : null}
      <TabBar current={tab === 'nexo' ? 'browse' : tab} draftCount={drafts.length} />
      {adding ? <AddSheet onClose={() => setAdding(false)} onAdd={(t, w, due) => { void addCard(user.uid, t, w, due); }} /> : null}
    </>
  );
}
