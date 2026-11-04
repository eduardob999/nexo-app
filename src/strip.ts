/**
 * The info strip on top of Today: weather, trains, free days, holidays, birthdays, events. The loop writes
 * `meta/today` (board/today_strip.py); this only reads it. Every part is optional and a missing one draws
 * nothing, because each source fails on its own.
 */
export interface Free { start: string; end?: string; name: string; kind?: string; lab?: string; note?: string }
export interface DayWeather { date: string; text?: string; min?: number; max?: number; rain?: number; sunrise?: string; sunset?: string }
export interface TodayInfo {
  updated?: string;
  weather?: { place?: string; now?: { temp?: number; text?: string }; days?: DayWeather[] };
  transit?: { line: string; status?: string; ok?: boolean }[];
  holidays?: { date: string; name: string }[];
  freeDay?: Free | null;
  nextFree?: Free | null;
  birthdays?: { name: string; date: string }[];
  events?: { title: string; date?: string; url?: string; place?: string }[];
}

export interface Strip {
  banner: Free | null;
  head: string[];
  weather: { now: string; today: string; tomorrow: string; sunset: string; place: string } | null;
  trains: { normal: boolean; bad: { line: string; status: string }[] } | null;
  days: { kind: 'next-free' | 'holiday' | 'birthday'; text: string; when: string; now: boolean }[];
  events: { title: string; when: string; url: string | null; place: string }[];
  updated: { label: string; stale: boolean } | null;
}

const DAY = 86_400_000;

/** Today's date in Japan as YYYY-MM-DD, whatever time zone the phone is in. */
export function jstDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
}

function gap(from: string, to: string): number | null {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(a) || Number.isNaN(b) ? null : Math.round((b - a) / DAY);
}

function shortDay(iso: string): string {
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(t) ? '' : new Date(t).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
}

function inDays(n: number): string {
  return n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`;
}

function span(x: Free): string {
  return x.end && x.end !== x.start ? `${shortDay(x.start)} to ${shortDay(x.end)}` : shortDay(x.start);
}

/** A free day that includes today. National holidays outrank university breaks. */
export function freeToday(t: TodayInfo, td: string): Free | null {
  const hit = [t.freeDay, t.nextFree].filter((x): x is Free => !!x && !!x.start && x.start <= td && td <= (x.end ?? x.start));
  hit.sort((a, b) => (a.kind === 'national' ? 0 : 1) - (b.kind === 'national' ? 0 : 1));
  return hit[0] ?? null;
}

export function buildStrip(t: TodayInfo | null | undefined, now: Date): Strip | null {
  if (!t || typeof t !== 'object') return null;
  const td = jstDay(now);
  const tom = new Date(Date.parse(`${td}T00:00:00Z`) + DAY).toISOString().slice(0, 10);
  const head: string[] = [];
  const s: Strip = { banner: freeToday(t, td), head, weather: null, trains: null, days: [], events: [], updated: null };

  const w = t.weather;
  if (w && (w.now || (w.days ?? []).length)) {
    const dayOf = (iso: string) => (w.days ?? []).find((x) => x && x.date === iso);
    const fmt = (x: DayWeather | undefined) =>
      x ? `${x.text ?? ''} ${x.min ?? ''}–${x.max ?? ''}°${x.rain != null ? ` · ${x.rain}% rain` : ''}`.trim() : '';
    const now0 = w.now && w.now.temp != null ? `${w.now.temp}° ${w.now.text ?? ''}`.trim() : '';
    if (now0) head.push(now0);
    s.weather = { now: now0, today: fmt(dayOf(td)), tomorrow: fmt(dayOf(tom)), sunset: dayOf(td)?.sunset ?? '', place: w.place ?? '' };
  }

  if (t.transit && t.transit.length) {
    const bad = t.transit.filter((x) => x && x.ok === false).map((x) => ({ line: x.line, status: x.status ?? 'disrupted' }));
    s.trains = { normal: bad.length === 0, bad };
    if (bad.length) head.push(`${bad.length} ${bad.length > 1 ? 'lines' : 'line'} disrupted`);
  }

  const next = t.nextFree && t.nextFree.start > td ? t.nextFree : null;
  if (next) {
    const g = gap(td, next.start);
    s.days.push({ kind: 'next-free', now: false, text: `Next free day: ${next.name}`,
      when: `${span(next)}${g != null ? `, ${inDays(g)}` : ''} · ${next.lab === 'confirm' ? 'no classes, lab: confirm' : 'no lab'}` });
  }
  const hol = (t.holidays ?? []).filter((x) => x && (gap(td, x.date) ?? -1) >= 0 && !(s.banner && x.date === td))
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  if (hol && !(next && next.start === hol.date)) {
    const g = gap(td, hol.date) ?? 0;
    s.days.push({ kind: 'holiday', now: g === 0, text: g === 0 ? `Today is a holiday: ${hol.name}` : hol.name, when: g === 0 ? '' : `${shortDay(hol.date)}, ${inDays(g)}` });
  }
  for (const b of (t.birthdays ?? []).filter((x) => x && (gap(td, x.date) ?? -1) >= 0 && (gap(td, x.date) ?? 99) <= 14).sort((a, c) => (a.date < c.date ? -1 : 1))) {
    const g = gap(td, b.date) ?? 0;
    s.days.push({ kind: 'birthday', now: g === 0, text: g === 0 ? `Birthday today: ${b.name}` : `${b.name}’s birthday`, when: g === 0 ? '' : `${shortDay(b.date)}, ${inDays(g)}` });
    if (g === 0) head.push(`${b.name}’s birthday`);
  }

  for (const e of (t.events ?? []).filter((x) => x && x.title && (!x.date || (gap(td, x.date) ?? 0) >= 0))) {
    // Only https becomes a link: these come from pages nobody here wrote.
    s.events.push({ title: e.title, when: e.date ? shortDay(e.date) : '', url: /^https:\/\/[^\s"'<>]+$/.test(e.url ?? '') ? (e.url as string) : null, place: e.place ?? '' });
  }

  if (t.updated) {
    const u = new Date(t.updated);
    if (!Number.isNaN(u.getTime())) {
      let label = u.toLocaleTimeString('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
      if (jstDay(u) !== td) label = `${shortDay(jstDay(u))} ${label}`;
      s.updated = { label, stale: now.getTime() - u.getTime() > 6 * 3_600_000 };
    }
  }
  const hasRows = s.weather || s.trains || s.days.length || s.events.length;
  return hasRows || s.banner ? s : null;
}
