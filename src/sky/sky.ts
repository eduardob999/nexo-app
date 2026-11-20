/**
 * The live background, as pure functions: the same inputs always give the same sky, and nothing here touches the network or the DOM.
 * Inputs: the time, a fixed place (Uji, never his phone's location), the weather, and what kind of day his cards say it is.
 * Output: colours, sun and moon, particles, a tint and an edge for events, and how dark to dim for bed. Readability is enforced in
 * `groundAlpha`, so no sky can ever make the title unreadable.
 */
export const UJI = { lat: 34.8845, lon: 135.8, tz: 540 };
const DAY = 86_400_000;
const MIN = 60_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Sunrise, solar noon and sunset in epoch ms for the local day containing `ms` (NOAA sunrise equation). */
export function sunTimes(ms: number, lat = UJI.lat, lon = UJI.lon, tz = UJI.tz): { rise: number; noon: number; set: number } {
  const localDay = Math.floor((ms + tz * MIN) / DAY);                   // days since 1970 of the local date
  const n = localDay - 10957;                                           // whole days since the J2000 epoch (2000-01-01 12:00) for that date
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(rad(M)) + 0.02 * Math.sin(rad(2 * M)) + 0.0003 * Math.sin(rad(3 * M));
  const lambda = (M + C + 180 + 102.9372) % 360;
  const transit = 2451545 + jStar + 0.0053 * Math.sin(rad(M)) - 0.0069 * Math.sin(rad(2 * lambda));
  const sinD = Math.sin(rad(lambda)) * Math.sin(rad(23.4397));
  const cosD = Math.cos(Math.asin(sinD));
  const cosW = (Math.sin(rad(-0.833)) - Math.sin(rad(lat)) * sinD) / (Math.cos(rad(lat)) * cosD);
  const w = (Math.acos(Math.max(-1, Math.min(1, cosW))) * 180) / Math.PI;
  const toMs = (j: number) => (j - 2440587.5) * DAY;
  return { rise: toMs(transit - w / 360), noon: toMs(transit), set: toMs(transit + w / 360) };
}

/** 0 new, 0.5 full. */
export function moonPhase(ms: number): number {
  const jd = ms / DAY + 2440587.5;
  const p = ((jd - 2451550.1) / 29.530588853) % 1;
  return p < 0 ? p + 1 : p;
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export function season(ms: number, tz = UJI.tz): Season {
  const m = new Date(ms + tz * MIN).getUTCMonth() + 1;
  return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
}

// ---- colour
type RGB = [number, number, number];
export const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const toHex = (c: RGB): string => '#' + c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export function luminance(c: RGB): number {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}
export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

type Palette = [string, string, string];     // top, middle, horizon
const NIGHT: Palette = ['#0b1026', '#141a3a', '#1d2550'];
const DAWN: Palette = ['#2b2f5e', '#c0607a', '#f2a65a'];
const MORNING: Palette = ['#6aa6e8', '#a8d0f0', '#f4e9d0'];
const NOON: Palette = ['#3f8fe0', '#7fbaf0', '#cfe6f7'];
const GOLDEN: Palette = ['#5b86c8', '#e8a46a', '#f6cf8a'];
const DUSK: Palette = ['#1f2a5e', '#7a4a8a', '#e07a6a'];

function lerpPalette(a: Palette, b: Palette, t: number): Palette {
  return [0, 1, 2].map((i) => toHex(mix(hex(a[i] as string), hex(b[i] as string), t))) as Palette;
}

/** The sky's colours at `ms`: keyframes anchored to that day's sunrise and sunset, blended linearly between them. */
export function palette(ms: number, tz = UJI.tz): Palette {
  const today = sunTimes(ms, UJI.lat, UJI.lon, tz);
  const prev = sunTimes(ms - DAY, UJI.lat, UJI.lon, tz);
  const next = sunTimes(ms + DAY, UJI.lat, UJI.lon, tz);
  const k: [number, Palette][] = [
    [prev.set + 50 * MIN, NIGHT], [today.rise - 50 * MIN, NIGHT], [today.rise - 5 * MIN, DAWN], [today.rise + 70 * MIN, MORNING],
    [today.noon - 90 * MIN, NOON], [today.noon + 90 * MIN, NOON], [today.set - 100 * MIN, GOLDEN], [today.set + 5 * MIN, DUSK],
    [today.set + 55 * MIN, NIGHT], [next.rise - 50 * MIN, NIGHT],
  ];
  if (ms <= (k[0] as [number, Palette])[0]) return NIGHT;
  for (let i = 0; i < k.length - 1; i++) {
    const [t0, p0] = k[i] as [number, Palette];
    const [t1, p1] = k[i + 1] as [number, Palette];
    if (ms >= t0 && ms <= t1) return lerpPalette(p0, p1, (ms - t0) / Math.max(1, t1 - t0));
  }
  return NIGHT;
}

// ---- weather
export type WeatherKind = 'clear' | 'cloud' | 'rain' | 'snow' | 'storm' | 'fog';
export interface Weather { kind: WeatherKind; cloud: number; temp: number; wind: number }

/** WMO weather code (Open-Meteo) to the kinds the sky knows. */
export function classify(code: number, cloudPct: number, temp: number, wind = 0): Weather {
  let kind: WeatherKind = 'clear';
  if (code >= 95) kind = 'storm';
  else if ((code >= 71 && code <= 77) || code === 85 || code === 86) kind = 'snow';
  else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) kind = temp <= 0.5 ? 'snow' : 'rain';
  else if (code === 45 || code === 48) kind = 'fog';
  else if (code >= 2 || cloudPct >= 60) kind = 'cloud';
  return { kind, cloud: Math.max(0, Math.min(1, cloudPct / 100)), temp, wind };
}

function weathered(p: Palette, w: Weather | null): Palette {
  if (!w) return p;
  const grey: RGB = w.kind === 'storm' ? [58, 62, 72] : w.kind === 'rain' ? [102, 110, 124] : w.kind === 'snow' || w.kind === 'fog' ? [190, 196, 205] : [150, 158, 170];
  const amount = w.kind === 'clear' ? w.cloud * 0.25 : w.kind === 'cloud' ? 0.25 + w.cloud * 0.3 : w.kind === 'storm' ? 0.7 : w.kind === 'fog' ? 0.65 : 0.5;
  return p.map((c, i) => toHex(mix(hex(c), grey, amount * (i === 0 ? 1 : 0.8)))) as Palette;
}

// ---- events
export interface DayEvent { kind: 'dojo' | 'assignment' | 'rest' | 'kyoto' | 'birthday' | 'trip'; at?: number; due?: number }

export type Particle = 'none' | 'rain' | 'snow' | 'petals' | 'leaves' | 'fireflies' | 'stars';
export interface SkyState {
  stops: Palette;
  sun: { x: number; y: number } | null;
  moon: { x: number; y: number; phase: number } | null;
  stars: number;
  particle: Particle;
  intensity: number;
  /** A colour laid over the sky for the kind of day, with its strength. */
  tint: { color: string; strength: number } | null;
  /** A thin warm edge that grows as an assignment nears. */
  edge: { color: string; strength: number } | null;
  /** The Keihan line at the horizon on a day he is in Kyoto. */
  horizon: boolean;
  /** 0 to 0.5: dimming for the wind-down before bed. */
  dim: number;
  mark: string | null;
}

export interface SkyInput { now: number; weather: Weather | null; events: DayEvent[]; bedMs?: number | undefined; tz?: number }

export function skyState(i: SkyInput): SkyState {
  const tz = i.tz ?? UJI.tz;
  const t = sunTimes(i.now, UJI.lat, UJI.lon, tz);
  const w = i.weather;
  let stops = weathered(palette(i.now, tz), w);
  const daylight = i.now > t.rise - 20 * MIN && i.now < t.set + 20 * MIN;
  const isNight = i.now < t.rise - 40 * MIN || i.now > t.set + 40 * MIN;
  const sunUp = i.now >= t.rise && i.now <= t.set;
  const sun = sunUp ? { x: (i.now - t.rise) / (t.set - t.rise), y: Math.sin(Math.PI * ((i.now - t.rise) / (t.set - t.rise))) } : null;
  const nightSpan = (t.rise + DAY) - t.set;
  const tn = i.now > t.set ? (i.now - t.set) / nightSpan : (i.now - (t.set - DAY)) / nightSpan;
  const moon = isNight ? { x: Math.max(0, Math.min(1, tn)), y: Math.sin(Math.PI * Math.max(0, Math.min(1, tn))), phase: moonPhase(i.now) } : null;
  const clouded = w && (w.kind === 'rain' || w.kind === 'storm' || w.kind === 'fog' || w.cloud > 0.7);
  const stars = isNight && !clouded ? 1 - (w?.cloud ?? 0) * 0.8 : 0;
  const s = season(i.now, tz);
  const hour = new Date(i.now + tz * MIN).getUTCHours();
  let particle: Particle = 'none';
  let intensity = 0;
  if (w?.kind === 'storm') { particle = 'rain'; intensity = 1; }
  else if (w?.kind === 'rain') { particle = 'rain'; intensity = 0.6; }
  else if (w?.kind === 'snow') { particle = 'snow'; intensity = 0.6; }
  else if (s === 'spring' && !clouded && daylight && new Date(i.now + tz * MIN).getUTCMonth() <= 3) { particle = 'petals'; intensity = 0.35; }
  else if (s === 'autumn' && !clouded && daylight && new Date(i.now + tz * MIN).getUTCMonth() >= 9) { particle = 'leaves'; intensity = 0.35; }
  else if (s === 'summer' && isNight && !clouded && new Date(i.now + tz * MIN).getUTCMonth() <= 6) { particle = 'fireflies'; intensity = 0.4; }
  else if (isNight && stars > 0.3) { particle = 'stars'; intensity = stars; }
  let tint: SkyState['tint'] = null;
  let edge: SkyState['edge'] = null;
  let horizon = false;
  let mark: string | null = null;
  for (const e of i.events) {
    if (e.kind === 'dojo') tint = { color: '#2a3f8f', strength: 0.35 };
    else if (e.kind === 'rest' && !tint) tint = { color: '#3f8f6a', strength: 0.3 };
    else if (e.kind === 'kyoto') horizon = true;
    else if (e.kind === 'birthday' || e.kind === 'trip') mark = e.kind;
    else if (e.kind === 'assignment' && e.due !== undefined) {
      const left = (e.due - i.now) / (3_600_000);
      if (left > 0 && left <= 24) { const strength = Math.max(edge?.strength ?? 0, 1 - left / 24); edge = { color: '#e8743c', strength }; }
    }
  }
  if (tint?.color === '#2a3f8f') stops = [toHex(mix(hex(stops[0]), hex('#2a3f8f'), 0.35)), toHex(mix(hex(stops[1]), hex('#c5a55a'), 0.2)), stops[2]];
  let dim = 0;
  if (i.bedMs !== undefined) {
    const d = (i.now - (i.bedMs - 90 * MIN)) / (90 * MIN);
    dim = Math.max(0, Math.min(1, d)) * 0.5;
  }
  if (hour >= 23 || hour < 5) dim = Math.max(dim, 0.35);
  return { stops, sun, moon, stars, particle, intensity, tint, edge, horizon, dim, mark };
}

/**
 * How strongly the sky may show behind the title. The title ink is dark in light mode and light in dark mode; the sky is blended with the
 * ground at `alpha`, and alpha is lowered until the ink keeps a contrast of at least 4.5 on the result. 0 means the sky is hidden.
 */
export function groundAlpha(topColor: string, ground: string, ink: string, wanted: number): number {
  let a = Math.max(0, Math.min(1, wanted));
  for (let k = 0; k < 40; k++) {
    if (contrast(mix(hex(ground), hex(topColor), a), hex(ink)) >= 4.5) return a;
    a -= 0.025;
    if (a <= 0) return 0;
  }
  return 0;
}

/** Cards, as the few fields the sky needs, to the kinds of day they describe. */
export interface CardLike { id: string; title?: string | undefined; type?: string | undefined; status?: string | undefined; due?: string | null | undefined; place?: string | undefined }
export function eventsFromCards(cards: CardLike[], now: number, tz = UJI.tz): DayEvent[] {
  const day0 = Math.floor((now + tz * MIN) / DAY) * DAY - tz * MIN;
  const out: DayEvent[] = [];
  for (const c of cards) {
    if (c.status === 'done' || !c.due) continue;
    const due = c.due.length <= 10 ? Date.parse(c.due + 'T23:59:00+09:00') : Date.parse(c.due);
    if (Number.isNaN(due)) continue;
    const today = due >= day0 && due < day0 + DAY;
    const title = (c.title ?? '').toLowerCase();
    if ((c.type ?? '').toUpperCase() === 'ASSIGNMENT' && due > now && due - now <= DAY) out.push({ kind: 'assignment', due });
    if (!today || due < now - 3 * 3_600_000) continue;
    if (c.id.startsWith('n-dojo-') || title.includes('dojo')) out.push({ kind: 'dojo', at: due });
    if (/^(yoshida|園山|河原町|kawaramachi)/i.test(c.place ?? '')) out.push({ kind: 'kyoto', at: due });
    if (title.includes('rest day')) out.push({ kind: 'rest', at: due });
    if (title.includes('birthday') || title.includes('cumple')) out.push({ kind: 'birthday', at: due });
    if ((c.type ?? '').toUpperCase() === 'TRIP') out.push({ kind: 'trip', at: due });
  }
  return out;
}
