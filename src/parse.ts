/**
 * Natural-language dates for the quick-add sheet, the part of Todoist's add
 * flow that highlights "by fri 4 pm" as you type. Small on purpose: relative
 * days, weekdays, "in N days" and a clock time. Anything it does not recognise
 * stays in the title, so a wrong guess never eats words.
 */
export interface Token { start: number; end: number; kind: 'date' | 'time' }
export interface Parsed { title: string; due: string | null; tokens: Token[] }

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const FULL = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function pad(n: number): string { return String(n).padStart(2, '0'); }

function offset(d: Date): string {
  const m = -d.getTimezoneOffset();
  const sign = m >= 0 ? '+' : '-';
  return `${sign}${pad(Math.floor(Math.abs(m) / 60))}:${pad(Math.abs(m) % 60)}`;
}

function ymd(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

const DATE_RE = new RegExp(
  `\\b(?:(?:by|on|due|before)\\s+)?(today|tonight|tomorrow|in\\s+(\\d{1,2})\\s+days?|next\\s+week|(?:next\\s+)?(${FULL.join('|')}|${WEEKDAYS.join('|')}))\\b`,
  'i',
);
const TIME_RE = /\b(?:(?:at|by)\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(?:(?:at|by)\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i;

export function parseQuickAdd(text: string, now: Date): Parsed {
  const tokens: Token[] = [];
  let day: Date | null = null;
  const d = DATE_RE.exec(text);
  if (d) {
    const word = (d[1] ?? '').toLowerCase();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (word === 'today' || word === 'tonight') day = base;
    else if (word === 'tomorrow') day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
    else if (word.startsWith('in')) day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + Number(d[2]));
    else if (word.startsWith('next week')) day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7);
    else {
      const name = (d[3] ?? '').toLowerCase();
      const idx = Math.max(FULL.indexOf(name), WEEKDAYS.indexOf(name.slice(0, 3)));
      const ahead = ((idx - base.getDay() + 7) % 7) || 7;
      day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + ahead);
    }
    tokens.push({ start: d.index, end: d.index + d[0].length, kind: 'date' });
  }
  let hh: number | null = null;
  let mm = 0;
  const t = TIME_RE.exec(text);
  const overlaps = t && tokens.some((k) => t.index < k.end && t.index + t[0].length > k.start);
  if (t && !overlaps) {
    if (t[3]) {
      hh = Number(t[1]) % 12 + (t[3].toLowerCase() === 'pm' ? 12 : 0);
      mm = t[2] ? Number(t[2]) : 0;
    } else {
      hh = Number(t[4]);
      mm = Number(t[5]);
    }
    tokens.push({ start: t.index, end: t.index + t[0].length, kind: 'time' });
  }
  tokens.sort((a, b) => a.start - b.start);

  let due: string | null = null;
  if (day || hh !== null) {
    const when = day ?? new Date(now.getFullYear(), now.getMonth(), now.getDate());
    due = hh === null ? ymd(when) : `${ymd(when)}T${pad(hh)}:${pad(mm)}:00${offset(when)}`;
  }

  let title = '';
  let at = 0;
  for (const k of tokens) { title += text.slice(at, k.start); at = k.end; }
  title += text.slice(at);
  return { title: title.replace(/\s+/g, ' ').trim(), due, tokens };
}
