import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { completeRedirectSignIn, describeAuthError, signInWithGoogle, watchAuthState } from './auth';
import { callNexo, markDone, watchOpenCards } from './cards';
import { isFirebaseConfigured } from './firebase';
import { Today } from './Today';
import type { Card } from './types';

function SignIn({ error, onSignIn }: { error: string; onSignIn: () => void }) {
  return (
    <main className="screen center">
      <h1>Nexo</h1>
      <button className="act primary big" onClick={onSignIn}>Sign in with Google</button>
      {error ? <p className="notice">{error}</p> : null}
    </main>
  );
}

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [cards, setCards] = useState<Card[]>([]);
  const [fromCache, setFromCache] = useState(true);
  const [error, setError] = useState('');

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
        onDone={(id) => { void markDone(user.uid, id); }} onCallNexo={() => { void callNexo(user.uid); }} />
      <nav className="tabs" aria-label="Sections">
        <button aria-current="page">Today</button><button>Nexo</button><button>Drafts</button><button>More</button>
      </nav>
    </>
  );
}
