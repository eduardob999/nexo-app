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
  | { name: 'money' }
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
  if (parts[0] === 'money') return { name: 'money' };
  return { name: 'today' };
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
