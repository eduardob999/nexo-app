/**
 * The Write module on its own: its own page (write.html), the same component Nexo mounts, no Nexo around it.
 * It brings only what the contract allows: a sign-in, the route from the URL hash, and <WriteModule>.
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { User } from 'firebase/auth';
import { completeRedirectSignIn, describeAuthError, signInWithGoogle, watchAuthState } from '../../auth';
import { isFirebaseConfigured } from '../../firebase';
import { parseHash } from '../../useHash';
import { WriteModule } from './index';
import '@fontsource/instrument-sans/latin-400.css';
import '@fontsource/instrument-sans/latin-600.css';
import '@fontsource/instrument-sans/latin-700.css';
import '@fontsource/dm-mono/latin-400.css';
import '@fontsource/dm-mono/latin-500.css';
import '../../styles.css';

function Standalone() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => { void completeRedirectSignIn().catch(() => {}); return watchAuthState(setUser); }, []);
  useEffect(() => { const on = () => setHash(window.location.hash); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  if (!isFirebaseConfigured) return <main className="screen center"><p className="notice">Firebase is not configured. Fill in .env.local.</p></main>;
  if (user === undefined) return <main className="screen center"><p className="notice">Loading</p></main>;
  if (user === null) {
    return (
      <main className="screen center signin">
        <h1>Write</h1>
        <p className="lede">Photograph a page, type your answers, get them checked.</p>
        <button className="send-wide" onClick={() => { signInWithGoogle().catch((e: unknown) => setError(describeAuthError(e))); }}>Continue with Google</button>
        {error ? <p className="notice">{error}</p> : null}
      </main>
    );
  }
  const r = parseHash(hash);
  return <WriteModule uid={user.uid} openId={r.name === 'homework' ? r.id : undefined} />;
}

const container = document.getElementById('root');
if (!container) throw new Error('No #root element found in write.html.');
createRoot(container).render(<StrictMode><Standalone /></StrictMode>);
