import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Secrets typed in the app go to `users/{uid}/secretbox/{name}`, a write-only drop box. The sync service on his computer
 * stores each one in ~/.config/nexo/{name}.env (outside every repo) and deletes the document. A secret is never on a card
 * and is never read back into the app: the only thing the app learns is the time it was stored (`meta/secrets`).
 */
export interface SecretField { key: string; label: string; type: 'text' | 'url' | 'password'; hint?: string; value?: string }
export interface SecretPreset { name: string; title: string; about: string; fields: SecretField[] }

export const PRESETS: SecretPreset[] = [
  {
    name: 'dojo',
    title: 'Dojo staff site',
    about: 'Nexo reads your shifts every morning and compares them with the board. It never changes anything on the site.',
    fields: [
      { key: 'DOJO_URL', label: 'Site address', type: 'url', value: 'https://enzan-daikyujo.the-true-works.com/' },
      { key: 'DOJO_USER', label: 'Login ID', type: 'text' },
      { key: 'DOJO_PASS', label: 'Password', type: 'password' },
    ],
  },
  {
    name: 'kaji',
    title: 'Kaji calendar',
    about: 'Where Kaji writes the chores, and the two calendars it reads so no chore lands on an event. These are calendar addresses, not passwords.',
    fields: [
      { key: 'KAJI_CALENDAR_ID', label: 'Kaji calendar id', type: 'text', hint: 'xxxx@group.calendar.google.com' },
      { key: 'KAJI_CAL_ME', label: 'Your calendar', type: 'text', hint: 'you@gmail.com' },
      { key: 'KAJI_CAL_PARTNER', label: 'Partner calendar', type: 'text', hint: 'her@gmail.com' },
    ],
  },
];

const KEY_RE = /^[A-Z][A-Z0-9_]{0,39}$/;
const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/** What is wrong with these values, or null. Never repeats a value. */
export function problem(name: string, fields: Record<string, string>): string | null {
  if (!NAME_RE.test(name)) return 'Bad secret name.';
  const keys = Object.keys(fields);
  if (keys.length === 0) return 'Nothing to send.';
  for (const k of keys) {
    const v = fields[k] ?? '';
    if (!KEY_RE.test(k)) return `Bad field name ${k}.`;
    if (v.trim() === '') return `${k} is empty.`;
    if (v.length > 512 || /[\r\n\0]/.test(v)) return `${k} has a line break or is too long.`;
  }
  return null;
}

export const defaults = (p: SecretPreset): Record<string, string> => Object.fromEntries(p.fields.filter((f) => f.value).map((f) => [f.key, f.value as string]));

/** Trim the pasted value except for a password, whose spaces are its own. */
export function clean(preset: SecretPreset, raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of preset.fields) out[f.key] = f.type === 'password' ? (raw[f.key] ?? '') : (raw[f.key] ?? '').trim();
  return out;
}

export function sendSecret(uid: string, name: string, fields: Record<string, string>): Promise<void> {
  const bad = problem(name, fields);
  if (bad) return Promise.reject(new Error(bad));
  return setDoc(doc(db, 'users', uid, 'secretbox', name), { fields, at: new Date().toISOString() });
}

/** When each secret was stored on the computer: { dojo: ISO time }. Names and times only. */
export function watchStored(uid: string, on: (stored: Record<string, string>) => void): () => void {
  return onSnapshot(doc(db, 'users', uid, 'meta', 'secrets'), (snap) => {
    const d = snap.data() as { stored?: Record<string, string> } | undefined;
    on(d?.stored ?? {});
  }, () => on({}));
}
