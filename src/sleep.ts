export interface SleepOption { label: string; until: Date }

/** The four durations he works in. "Until tomorrow" wakes at 08:00, before the hours he starts. */
export function sleepOptions(now: Date): SleepOption[] {
  const hour = (h: number) => new Date(now.getTime() + h * 3_600_000);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0);
  const tomorrow8 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0, 0, 0);
  const opts: SleepOption[] = [{ label: '1 hour', until: hour(1) }, { label: '3 hours', until: hour(3) }];
  // "Rest of the day" is meaningless in the last few minutes of it, and would not outlast the 3 hours anyway.
  if (endOfDay.getTime() - now.getTime() > 3 * 3_600_000) opts.push({ label: 'Rest of the day', until: endOfDay });
  opts.push({ label: 'Until tomorrow', until: tomorrow8 });
  return opts;
}

export function untilLabel(d: Date, now: Date): string {
  const t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? t : `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${t}`;
}
