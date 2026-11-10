import { useEffect, useRef, useState } from 'react';
import { directionsUrl, distanceText, findNearby, geoErrorText, KIND_LABEL, KINDS, walkMinutes, type Kind, type Place } from './nearby';

type State =
  | { s: 'idle' }
  | { s: 'locating' }
  | { s: 'searching' }
  | { s: 'done'; found: Partial<Record<Kind, Place>>; at: Date; accuracy: number }
  | { s: 'error'; text: string };

/**
 * Closest combini, station, toilet and pharmacy, only when he asks. His words:
 * "it can work with its own button so no micro consumption of tokens piles up".
 * So the position is requested on the press and never on load, it lives in this
 * component's state and nowhere else (not state.json, Firestore, localStorage or
 * a log), and a press costs one free OpenStreetMap request and no model call.
 */
export function Nearby() {
  const [st, setSt] = useState<State>({ s: 'idle' });
  const abort = useRef<AbortController | null>(null);
  // Each press gets a number, so a late answer from a press he has since closed or repeated is dropped.
  const gen = useRef(0);
  useEffect(() => () => { gen.current++; abort.current?.abort(); }, []);

  const run = () => {
    if (!('geolocation' in navigator)) { setSt({ s: 'error', text: 'This browser cannot share a location.' }); return; }
    abort.current?.abort();
    const mine = ++gen.current;
    setSt({ s: 'locating' });
    navigator.geolocation.getCurrentPosition(async (pos) => {
      if (gen.current !== mine) return;
      const ctl = new AbortController();
      abort.current = ctl;
      const timer = setTimeout(() => ctl.abort(), 25000);
      setSt({ s: 'searching' });
      try {
        const found = await findNearby({ lat: pos.coords.latitude, lon: pos.coords.longitude }, (u, i) => fetch(u, i), ctl.signal);
        if (gen.current === mine) setSt({ s: 'done', found, at: new Date(), accuracy: pos.coords.accuracy });
      } catch (e) {
        if (gen.current !== mine) return;
        setSt({ s: 'error', text: ctl.signal.aborted ? 'The OpenStreetMap server did not answer in time. Try again.' : e instanceof Error && /OpenStreetMap/.test(e.message) ? e.message : 'Could not reach OpenStreetMap. Check the connection and try again.' });
      } finally { clearTimeout(timer); }
    }, (err) => gen.current === mine && setSt({ s: 'error', text: geoErrorText(err.code) }), { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  };

  const busy = st.s === 'locating' || st.s === 'searching';
  if (st.s === 'idle') {
    return (
      <section className="nearby">
        <button type="button" className="chip-btn nearby-find" onClick={run}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7" /></svg>
          Find nearby
        </button>
      </section>
    );
  }
  return (
    <section className="nearby open" aria-live="polite">
      <div className="nearby-head">
        <span className="strip-head">Nearby</span>
        {st.s === 'done' ? <span className="strip-up">{st.at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}{st.accuracy > 200 ? ` · ±${Math.round(st.accuracy)} m` : ''}</span> : null}
        <button type="button" className="chip-btn small" disabled={busy} onClick={run}>{busy ? (st.s === 'locating' ? 'Locating…' : 'Searching…') : 'Refresh'}</button>
        <button type="button" className="chip-btn small" aria-label="Close nearby" onClick={() => { gen.current++; abort.current?.abort(); abort.current = null; setSt({ s: 'idle' }); }}>Close</button>
      </div>
      {st.s === 'error' ? <p className="nearby-err">{st.text}</p> : null}
      {st.s === 'done' ? (
        <ul className="nearby-list">
          {KINDS.map((k) => {
            const p = st.found[k];
            return (
              <li key={k}>
                <span className="lab">{KIND_LABEL[k]}</span>
                {p ? (
                  <a href={directionsUrl(p)} target="_blank" rel="noopener noreferrer">
                    <span className="nearby-name">{p.name}</span>
                    <span className="mut">{distanceText(p.metres)} · {walkMinutes(p.metres)} min walk</span>
                  </a>
                ) : <span className="mut">none within 1.5 km</span>}
              </li>
            );
          })}
        </ul>
      ) : null}
      {st.s === 'done' ? <p className="nearby-credit mut">Straight-line distance. Data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors</p> : null}
    </section>
  );
}
