import { classify, UJI, type Weather } from './sky';

const KEY = 'nexo-sky-weather';
const FRESH = 30 * 60_000;

/** Open-Meteo's "current" block to the sky's weather. Null when the shape is not what we expect. */
export function parseWeather(j: unknown): Weather | null {
  const c = (j as { current?: Record<string, unknown> } | null)?.current;
  if (!c || typeof c.weather_code !== 'number') return null;
  return classify(c.weather_code, typeof c.cloud_cover === 'number' ? c.cloud_cover : 0, typeof c.temperature_2m === 'number' ? c.temperature_2m : 15, typeof c.wind_speed_10m === 'number' ? c.wind_speed_10m : 0);
}

export function readCache(now: number, raw: string | null): Weather | null {
  try {
    const x = JSON.parse(raw ?? 'null') as { at: number; w: Weather } | null;
    return x && now - x.at < FRESH * 8 ? x.w : null;     // up to four hours old beats no weather when offline
  } catch { return null; }
}

/** Fixed point in Uji, nothing else is sent. Cached for thirty minutes; offline falls back to the last answer, then to nothing. */
export async function fetchWeather(now = Date.now()): Promise<Weather | null> {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); } catch { /* private mode */ }
  try {
    const x = JSON.parse(raw ?? 'null') as { at: number; w: Weather } | null;
    if (x && now - x.at < FRESH) return x.w;
  } catch { /* fall through */ }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${UJI.lat.toFixed(2)}&longitude=${UJI.lon.toFixed(2)}&current=temperature_2m,cloud_cover,weather_code,wind_speed_10m&timezone=Asia%2FTokyo`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    const w = parseWeather(await r.json());
    if (w) { try { window.localStorage.setItem(KEY, JSON.stringify({ at: now, w })); } catch { /* private mode */ } }
    return w;
  } catch {
    return readCache(now, raw);
  }
}
