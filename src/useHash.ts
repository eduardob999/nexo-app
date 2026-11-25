import { useEffect, useState } from 'react';

export type Route =
  | { name: 'today' }
  | { name: 'nexo' }
  | { name: 'drafts' }
  | { name: 'upcoming' }
  | { name: 'browse' }
  | { name: 'search' }
  | { name: 'shelf' }
  | { name: 'trips' }
  | { name: 'notes' }
  | { name: 'chat' }
  | { name: 'sleep' }
  | { name: 'homework'; id?: string }
  | { name: 'kaji'; id?: string }
  | { name: 'card'; id: string };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'card' && parts[1]) return { name: 'card', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'nexo') return { name: 'nexo' };
  if (parts[0] === 'drafts') return { name: 'drafts' };
  if (parts[0] === 'upcoming') return { name: 'upcoming' };
  if (parts[0] === 'browse') return { name: 'browse' };
  if (parts[0] === 'search') return { name: 'search' };
  if (parts[0] === 'shelf') return { name: 'shelf' };
  if (parts[0] === 'trips') return { name: 'trips' };
  if (parts[0] === 'notes') return { name: 'notes' };
  // Money moved into Kaji; the old address still opens it.
  if (parts[0] === 'money') return { name: 'kaji', id: 'money' };
  if (parts[0] === 'chat') return { name: 'chat' };
  if (parts[0] === 'sleep') return { name: 'sleep' };
  if (parts[0] === 'homework') return parts[1] ? { name: 'homework', id: decodeURIComponent(parts[1]) } : { name: 'homework' };
  if (parts[0] === 'kaji') return parts[1] ? { name: 'kaji', id: decodeURIComponent(parts[1]) } : { name: 'kaji' };
  return { name: 'today' };
}

/** True when the address asks for Kaji's money tab. */
export function wantsMoney(hash = typeof window === 'undefined' ? '' : window.location.hash): boolean {
  return /^#\/(kaji\/)?money$/.test(hash);
}

/** The route lives in the URL hash, so the phone's back gesture and a reload both work with no router library. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
