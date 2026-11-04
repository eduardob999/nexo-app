export type Tone = 'ok' | 'warn';
type Listener = (msg: string, tone: Tone) => void;
const listeners = new Set<Listener>();

/** A short message at the bottom of the screen. Calm for what worked, a warning for what did not. */
export function flash(msg: string, tone: Tone = 'ok'): void {
  listeners.forEach((l) => l(msg, tone));
}
export function subscribeFlash(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
