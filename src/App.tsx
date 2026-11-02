import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { AddSheet } from './AddSheet';
import { completeRedirectSignIn, describeAuthError, signInWithGoogle, watchAuthState } from './auth';
import { addCard, callNexo, markDone, markLater, watchOpenCards } from './cards';
import { isFirebaseConfigured } from './firebase';
import { TabBar } from './TabBar';
import { Today } from './Today';
import type { Card } from './types';

function SignIn({ error, onSignIn }: { error: string; onSignIn: () => void }) {
  return (
    <main className="screen center">
      <h1>Nexo</h1>
      <button className="send-wide" onClick={onSignIn}>Sign in with Google</button>
      {error ? <p className="notice">{error}</p> : null}
    </main>
  );
}

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [cards, setCards] = useState<Card[]>([]);
  const [fromCache, setFromCache] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    void completeRedirectSignIn();
    return watchAuthState(setUser);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    return watchOpenCards(user.uid, (c, cache) => { setCards(c); setFromCache(cache); }, (e) => setError(e.message));
  }, [user]);

  if (!isFirebaseConfigured) return <main className="screen center"><p className="notice">Firebase is not configured. Fill in .env.local.</p></main>;
  if (user === undefined) return <main className="screen center"><p className="notice">Loading</p></main>;
  if (user === null) {
    return <SignIn error={error} onSignIn={() => { signInWithGoogle().catch((e: unknown) => setError(describeAuthError(e))); }} />;
  }
  return (
    <>
      <Today cards={cards} now={new Date()} fromCache={fromCache}
        onDone={(c) => { void markDone(user.uid, c.id); }}
        onLater={(c) => { void markLater(user.uid, c); }}
        onCallNexo={() => { void callNexo(user.uid); }} />
      <button className="fab" aria-label="Add a task" onClick={() => setAdding(true)}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <TabBar current="today" />
      {adding ? <AddSheet onClose={() => setAdding(false)} onAdd={(t, w) => { void addCard(user.uid, t, w); }} /> : null}
    </>
  );
}
