export const MIN = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;
export const JST = 540;

export function hm(s: string): number {
  const [h, m] = s.split(':');
  return Number(h) * 60 + Number(m ?? 0);
}

/** Midnight of the local day containing `ms`, for a zone `tz` minutes east of UTC. */
export function dayStart(ms: number, tz = JST): number {
  return Math.floor((ms + tz * MIN) / DAY) * DAY - tz * MIN;
}

export function atHm(day: number, s: string): number {
  return day + hm(s) * MIN;
}

/** 0 = Sunday. */
export function weekday(ms: number, tz = JST): number {
  return new Date(dayStart(ms, tz) + tz * MIN).getUTCDay();
}

export function dayKey(ms: number, tz = JST): string {
  return new Date(dayStart(ms, tz) + tz * MIN).toISOString().slice(0, 10);
}

export function overlaps(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1;
}

export function clockLabel(ms: number, tz = JST): string {
  const d = new Date(ms + tz * MIN);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
