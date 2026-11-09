/**
 * Autosave for a text field that is typed with an input method (Gboard, kanji conversion).
 *
 * While a composition is open (the kana he is still converting), the text in the box is not final: saving it
 * would store half a word and then fight the keyboard when the other device echoes it back. So nothing is saved,
 * and no timer fires, until the composition ends. Android keyboards do not always fire compositionstart, so the
 * caller also passes the input event's own `isComposing`, and either one counts.
 *
 * Pure apart from the timer functions, which are injected so the rules can be tested without a browser.
 */
export type SaveState = 'idle' | 'dirty' | 'saved';

export interface Timers { set: (fn: () => void, ms: number) => unknown; clear: (id: unknown) => void }
const REAL: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) };

export class Autosaver {
  private composing = false;
  private pending: unknown = null;
  private text: string;
  private saved: string;
  state: SaveState = 'idle';

  constructor(initial: string, private readonly save: (text: string) => void, private readonly onState: (s: SaveState) => void = () => {}, private readonly delay = 700, private readonly timers: Timers = REAL) {
    this.text = initial;
    this.saved = initial;
  }

  private set(s: SaveState) { if (this.state !== s) { this.state = s; this.onState(s); } }
  private cancel() { if (this.pending !== null) { this.timers.clear(this.pending); this.pending = null; } }

  private commit() {
    this.cancel();
    if (this.text !== this.saved) { this.saved = this.text; this.save(this.text); this.set('saved'); } else if (this.state === 'dirty') this.set('idle');
  }

  private schedule() {
    this.cancel();
    this.pending = this.timers.set(() => { this.pending = null; if (!this.composing) this.commit(); }, this.delay);
  }

  /** The field's text changed. `isComposing` is the native input event's flag. */
  change(text: string, isComposing = false) {
    this.text = text;
    if (isComposing) this.composing = true;
    if (text !== this.saved) this.set('dirty');
    if (!this.composing) this.schedule();
  }

  compositionStart() { this.composing = true; this.cancel(); }

  /** The composition ended with `text` in the box: now it is real text, save after the quiet time. */
  compositionEnd(text: string) {
    this.composing = false;
    this.text = text;
    if (text !== this.saved) { this.set('dirty'); this.schedule(); }
  }

  /** The field lost focus. Saves at once, unless a composition is still open (its end will save). */
  blur() { if (!this.composing) this.commit(); }

  /** The saved text changed elsewhere (another device) and the field took it over. */
  adopt(text: string) { this.cancel(); this.text = text; this.saved = text; this.composing = false; this.set('idle'); }

  dispose() { this.cancel(); }
}
