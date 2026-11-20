import { useEffect, useMemo, useState } from 'react';
import { eventsFromCards, skyState, type CardLike, type SkyState, type Weather } from './sky';
import { fetchWeather } from './weather';

/** The current sky for the app: weather refreshed every thirty minutes, time every minute, events from the open cards. */
export function useSky(cards: CardLike[], bedMs: number | undefined, enabled: boolean): SkyState | null {
  const [now, setNow] = useState(() => Date.now());
  const [weather, setWeather] = useState<Weather | null>(null);
  useEffect(() => {
    if (!enabled) return undefined;
    const i = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(i);
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    const go = () => { void fetchWeather().then((w) => { if (live) setWeather(w); }); };
    go();
    const i = window.setInterval(go, 30 * 60_000);
    return () => { live = false; window.clearInterval(i); };
  }, [enabled]);
  const events = useMemo(() => eventsFromCards(cards, now), [cards, now]);
  return useMemo(() => (enabled ? skyState({ now, weather, events, bedMs }) : null), [enabled, now, weather, events, bedMs]);
}
