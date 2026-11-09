/**
 * What to take with him, from the hour-by-hour forecast the loop's strip script stores
 * (`weather.days[].h`). Pure functions: the same forecast and the same hour give the same list.
 * No model is involved; every line carries the reason, so the advice can be checked at a glance.
 */
import type { DayWeather } from './strip';

export interface GearItem { item: string; why: string }
export interface GearCtx { bike?: boolean }

const pad = (h: number) => String(h).padStart(2, '0');

/** Hours from `from` to `to` (inclusive) where `pred` holds, as one "15–18h" style range string. */
function span(vals: number[], from: number, to: number, pred: (v: number) => boolean): string {
  const hit: number[] = [];
  for (let h = from; h <= to; h++) if (pred(vals[h] ?? 0)) hit.push(h);
  if (!hit.length) return '';
  const a = hit[0] as number;
  const b = hit[hit.length - 1] as number;
  return a === b ? `${pad(a)}h` : `${pad(a)}–${pad(b)}h`;
}

/**
 * Gear for the waking hours still ahead. `fromHour` is the current hour for today and 7 for a later
 * day; the window runs to 22h. Without hourly data it falls back to the day's own min, max and rain.
 */
export function gearFor(day: DayWeather | undefined, fromHour: number, ctx: GearCtx = {}): GearItem[] {
  if (!day) return [];
  const from = Math.min(Math.max(fromHour, 0), 22);
  const to = 22;
  const h = day.h;
  const out: GearItem[] = [];

  const pop = h?.pop ?? [];
  const feels = h?.feels ?? [];
  const wind = h?.wind ?? [];
  const uv = h?.uv ?? [];
  const win = (a: number[]) => a.slice(from, to + 1).filter((x) => typeof x === 'number');
  const maxPop = h ? Math.max(0, ...win(pop)) : (day.rain ?? 0);
  const maxWind = h ? Math.max(0, ...win(wind)) : 0;
  const fl = win(feels);
  const minF = fl.length ? Math.min(...fl) : day.min;
  const maxF = fl.length ? Math.max(...fl) : day.max;
  const maxUv = h ? Math.max(0, ...win(uv)) : 0;

  if (maxPop >= 50) {
    const when = h ? span(pop, from, to, (v) => v >= 50) : '';
    const reason = `${maxPop}% rain${when ? ` ${when}` : ''}`;
    if (maxWind >= 35 || (ctx.bike && maxPop >= 50)) {
      out.push({ item: 'Rain jacket', why: `${reason}${maxWind >= 35 ? `, wind up to ${maxWind} km/h` : ', on the bike'}` });
    } else {
      out.push({ item: 'Umbrella', why: reason });
    }
  } else if (maxPop >= 30) {
    out.push({ item: 'Folding umbrella', why: `${maxPop}% rain, just in case` });
  }

  if (minF != null) {
    if (minF <= 4) out.push({ item: 'Warm coat, gloves, scarf', why: `feels ${minF}° at the coldest` });
    else if (minF <= 9) out.push({ item: 'Warm coat', why: `feels ${minF}° at the coldest` });
    else if (minF <= 15) out.push({ item: 'Light jacket', why: minF === (maxF ?? minF) ? `feels ${minF}°` : `feels ${minF}–${maxF}°` });
  }
  if (maxF != null && maxF >= 30) out.push({ item: 'Water bottle, light clothes', why: `feels ${maxF}°` });
  if (minF != null && maxF != null && maxF - minF >= 8 && minF > 4 && minF <= 20) {
    out.push({ item: 'A layer for later', why: `drops to ${minF}° from ${maxF}°` });
  }
  if (maxUv >= 6) out.push({ item: 'Sunscreen, cap', why: `UV ${maxUv}` });
  if (ctx.bike && maxWind >= 25 && maxWind < 35) out.push({ item: 'Windproof layer', why: `wind up to ${maxWind} km/h on the bike` });
  if (ctx.bike && day.sunset) {
    const sh = Number(day.sunset.slice(0, 2));
    if (!Number.isNaN(sh) && sh <= to) out.push({ item: 'Bike lights', why: `dark from ${day.sunset}` });
  }
  return out;
}

/**
 * Rain that is about to start: not raining now (chance under 50%), and 60% or more within the next
 * three hours. Returns the hour it starts, or null.
 */
export function rainSoon(day: DayWeather | undefined, hour: number): number | null {
  const pop = day?.h?.pop;
  if (!pop || (pop[hour] ?? 0) >= 50) return null;
  for (let k = 1; k <= 3; k++) if ((pop[hour + k] ?? 0) >= 60) return hour + k;
  return null;
}
